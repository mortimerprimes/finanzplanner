import { ExpenseAttachment, IncomeType, Settings } from '../types';
import { classifyBankTransactionLocally, ParsedBankTransaction } from '../utils/bankImport';

export interface AIExpenseSuggestion {
  description: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
  tags?: string[];
  merchant?: string;
  confidence?: number;
  isRecurring?: boolean;
}

interface ReceiptAnalysisInput {
  settings: Settings;
  attachment: ExpenseAttachment;
  categories: Array<{ id: string; label: string }>;
  selectedMonth: string;
}

interface SpeechParsingInput {
  settings: Settings;
  transcript: string;
  categories: Array<{ id: string; label: string }>;
  selectedMonth: string;
}

interface ProviderConfig {
  provider: Settings['ai']['provider'];
  model: string;
  apiKey: string;
  endpoint?: string;
}

const OPENAI_DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENROUTER_DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export interface AIModelOption {
  id: string;
  label: string;
}

export interface AIBankTransactionSuggestion {
  id: string;
  category: string;
  incomeType: IncomeType;
  confidence?: number;
  description?: string;
  note?: string;
}

function extractBase64(dataUrl: string): { mimeType: string; data: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error('Ungültiges Datei-Format für AI-Analyse.');
  }

  return {
    mimeType: match[1],
    data: match[2],
  };
}

function extractJsonPayload(rawText: string): unknown {
  const codeBlockMatch = rawText.match(/```json\s*([\s\S]*?)```/i) || rawText.match(/```\s*([\s\S]*?)```/i);
  const source = codeBlockMatch?.[1] || rawText;
  const trimmed = source.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }

    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    throw new Error('Die AI-Antwort konnte nicht als JSON gelesen werden.');
  }
}

function normalizeCategory(category: string, categories: Array<{ id: string; label: string }>): string {
  const normalized = category.trim().toLowerCase();
  const exact = categories.find((item) => item.id.toLowerCase() === normalized || item.label.toLowerCase() === normalized);
  if (exact) return exact.id;

  const partial = categories.find((item) => {
    const id = item.id.toLowerCase();
    const label = item.label.toLowerCase();
    return normalized.includes(id) || normalized.includes(label) || id.includes(normalized) || label.includes(normalized);
  });

  return partial?.id || 'other';
}

function normalizeSuggestions(
  payload: unknown,
  categories: Array<{ id: string; label: string }>,
  selectedMonth: string
): AIExpenseSuggestion[] {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { entries?: unknown[] })?.entries)
      ? (payload as { entries: unknown[] }).entries
      : [];

  const suggestions: AIExpenseSuggestion[] = [];

  rows.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const entry = row as Record<string, unknown>;
    const amount = Number(entry.amount);
    const description = String(entry.description || entry.merchant || '').trim();
    if (!description || !Number.isFinite(amount) || amount <= 0) return;
    const date = typeof entry.date === 'string' && entry.date.length >= 10
      ? entry.date.slice(0, 10)
      : `${selectedMonth}-01`;

    suggestions.push({
      description,
      amount,
      category: normalizeCategory(String(entry.category || 'other'), categories),
      date,
      note: typeof entry.note === 'string' ? entry.note : undefined,
      tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => String(tag)).filter(Boolean) : [],
      merchant: typeof entry.merchant === 'string' ? entry.merchant : undefined,
      confidence: Number.isFinite(Number(entry.confidence)) ? Number(entry.confidence) : undefined,
      isRecurring: Boolean(entry.isRecurring),
    });
  });

  return suggestions;
}

async function callGeminiText(config: ProviderConfig, prompt: string, image?: ExpenseAttachment): Promise<string> {
  const modelPath = `${config.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models'}/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const parts = image
    ? (() => {
        const { mimeType, data } = extractBase64(image.dataUrl);
        return [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data,
            },
          },
        ];
      })()
    : [{ text: prompt }];

  const response = await fetch(modelPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini-Fehler: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim();
  if (!text) {
    throw new Error('Gemini hat keine verwertbare Antwort geliefert.');
  }

  return text;
}

async function callOpenAICompatibleText(config: ProviderConfig, prompt: string, image?: ExpenseAttachment): Promise<string> {
  const endpoint = config.endpoint || OPENAI_DEFAULT_ENDPOINT;
  const content = image
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image.dataUrl } },
      ]
    : prompt;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI-kompatibler Fehler: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Das Modell hat keine verwertbare Antwort geliefert.');
  }

  return text;
}

async function callOpenRouterText(config: ProviderConfig, prompt: string, image?: ExpenseAttachment): Promise<string> {
  const endpoint = config.endpoint || OPENROUTER_DEFAULT_ENDPOINT;
  const content = image
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: image.dataUrl } },
      ]
    : prompt;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Finanzplanner',
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter-Fehler: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenRouter hat keine verwertbare Antwort geliefert.');
  }

  return text;
}

async function callAIProvider(config: ProviderConfig, prompt: string, image?: ExpenseAttachment): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Bitte hinterlege zuerst einen API-Key in den Einstellungen.');
  }

  if (config.provider === 'gemini') {
    return callGeminiText(config, prompt, image);
  }

  if (config.provider === 'openai-compatible') {
    return callOpenAICompatibleText(config, prompt, image);
  }

  if (config.provider === 'openrouter') {
    return callOpenRouterText(config, prompt, image);
  }

  throw new Error('Es ist kein aktiver AI-Provider konfiguriert.');
}

function deriveModelsEndpoint(config: ProviderConfig): string {
  if (config.provider === 'gemini') {
    return config.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  if (config.provider === 'openrouter') {
    if (config.endpoint?.includes('/models')) return config.endpoint;
    return 'https://openrouter.ai/api/v1/models';
  }

  const endpoint = config.endpoint || OPENAI_DEFAULT_ENDPOINT;
  return endpoint.replace(/\/chat\/completions$/, '/models');
}

export async function fetchAvailableModels(config: ProviderConfig): Promise<AIModelOption[]> {
  if (!config.apiKey || config.provider === 'disabled') {
    return [];
  }

  if (config.provider === 'gemini') {
    const modelsEndpoint = `${deriveModelsEndpoint(config)}?key=${encodeURIComponent(config.apiKey)}`;
    const response = await fetch(modelsEndpoint);
    if (!response.ok) {
      throw new Error(`Modelle konnten nicht geladen werden: ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    return (json?.models || [])
      .filter((model: { name?: string; supportedGenerationMethods?: string[] }) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model: { name: string; displayName?: string }) => {
        const id = model.name.replace(/^models\//, '');
        return { id, label: model.displayName || id };
      });
  }

  const response = await fetch(deriveModelsEndpoint(config), {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      ...(config.provider === 'openrouter'
        ? { 'HTTP-Referer': window.location.origin, 'X-Title': 'Finanzplanner' }
        : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Modelle konnten nicht geladen werden: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return (json?.data || []).map((model: { id: string; name?: string }) => ({
    id: model.id,
    label: model.name || model.id,
  }));
}

export async function testAIConnection(config: ProviderConfig): Promise<string> {
  if (!config.apiKey || config.provider === 'disabled') {
    throw new Error('Bitte zuerst Provider und API-Key konfigurieren.');
  }

  const prompt = 'Antworte exakt mit {"status":"ok"} als JSON.';
  const raw = await callAIProvider(config, prompt);
  const payload = extractJsonPayload(raw) as { status?: string };
  if (payload?.status !== 'ok') {
    throw new Error('Die AI-Antwort war nicht gültig.');
  }
  return 'API-Key und Endpoint funktionieren.';
}

export async function analyzeReceiptWithAI(input: ReceiptAnalysisInput): Promise<AIExpenseSuggestion[]> {
  const { settings, attachment, categories, selectedMonth } = input;
  const prompt = `
Analysiere dieses Foto einer Rechnung oder Quittung fuer eine Finanzplaner-App.
Extrahiere passende Ausgaben als JSON.

Erlaubte Kategorien:
${categories.map((category) => `- ${category.id}: ${category.label}`).join('\n')}

Antwortformat:
{
  "entries": [
    {
      "description": "Kurze sinnvolle Buchungsbeschreibung",
      "merchant": "Haendler oder Quelle",
      "amount": 12.34,
      "date": "YYYY-MM-DD",
      "category": "eine erlaubte Kategorie-ID",
      "note": "optional",
      "tags": ["optional"],
      "confidence": 0.0
    }
  ]
}

Regeln:
- Gib nur valides JSON zurueck.
- Summen als Zahlen, nicht als Strings.
- Nutze grossen Gesamtbetrag oder logisch sinnvolle relevante Einzelbuchungen.
- Wenn das Datum nicht klar ist, nutze ${selectedMonth}-01.
- Wenn du unsicher bist, setze confidence niedriger und waehle "other".
`.trim();

  const raw = await callAIProvider(
    {
      provider: settings.ai.provider,
      model: settings.ai.model,
      apiKey: settings.ai.apiKey,
      endpoint: settings.ai.endpoint,
    },
    prompt,
    attachment
  );

  return normalizeSuggestions(extractJsonPayload(raw), categories, selectedMonth);
}

function parseSpeechTranscriptLocally(
  transcript: string,
  categories: Array<{ id: string; label: string }>,
  selectedMonth: string
): AIExpenseSuggestion[] {
  const segments = transcript
    .split(/[,;\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const suggestions: AIExpenseSuggestion[] = [];

  segments.forEach((segment) => {
    const amountMatch = segment.match(/(\d+(?:[.,]\d{1,2})?)/);
    if (!amountMatch) return;
    const amount = Number(amountMatch[1].replace(',', '.'));
    const description = segment.replace(amountMatch[0], '').replace(/euro/gi, '').trim();
    if (!Number.isFinite(amount) || !description) return;
    suggestions.push({
      description: description.charAt(0).toUpperCase() + description.slice(1),
      amount,
      category: normalizeCategory(description, categories),
      date: `${selectedMonth}-01`,
      confidence: 0.45,
      tags: [],
    });
  });

  return suggestions;
}

export async function parseSpeechExpenses(input: SpeechParsingInput): Promise<AIExpenseSuggestion[]> {
  const { settings, transcript, categories, selectedMonth } = input;

  if (!settings.ai.enabled || settings.ai.provider === 'disabled' || !settings.ai.voiceAssistant || !settings.ai.apiKey) {
    return parseSpeechTranscriptLocally(transcript, categories, selectedMonth);
  }

  const prompt = `
Wandle diese gesprochene Finanznotiz in strukturierte Ausgaben um.
Transkript:
"""
${transcript}
"""

Erlaubte Kategorien:
${categories.map((category) => `- ${category.id}: ${category.label}`).join('\n')}

Antwortformat:
{
  "entries": [
    {
      "description": "Buchungsbeschreibung",
      "amount": 12.34,
      "date": "YYYY-MM-DD",
      "category": "eine erlaubte Kategorie-ID",
      "note": "optional",
      "tags": ["optional"],
      "confidence": 0.0
    }
  ]
}

Regeln:
- Nur valides JSON.
- Jede erkannte Ausgabe als eigener Eintrag.
- Wenn kein Datum genannt wird, nutze ${selectedMonth}-01.
- Wenn Kategorie unklar ist, waehle "other".
`.trim();

  const raw = await callAIProvider(
    {
      provider: settings.ai.provider,
      model: settings.ai.model,
      apiKey: settings.ai.apiKey,
      endpoint: settings.ai.endpoint,
    },
    prompt
  );

  return normalizeSuggestions(extractJsonPayload(raw), categories, selectedMonth);
}

export async function categorizeBankTransactionsWithAI(input: {
  settings: Settings;
  transactions: ParsedBankTransaction[];
  categories: Array<{ id: string; label: string }>;
}): Promise<AIBankTransactionSuggestion[]> {
  const { settings, transactions, categories } = input;

  if (!settings.ai.enabled || settings.ai.provider === 'disabled' || !settings.ai.apiKey) {
    return transactions.map((transaction) => {
      const local = classifyBankTransactionLocally(transaction);
      return {
        id: transaction.id,
        category: local.category,
        incomeType: local.incomeType,
        confidence: local.confidence,
      };
    });
  }

  const results: AIBankTransactionSuggestion[] = [];

  for (let index = 0; index < transactions.length; index += 25) {
    const chunk = transactions.slice(index, index + 25);
    const prompt = `
Ordne Banktransaktionen fuer eine Finanzplaner-App zu.
Jeder Eintrag ist bereits als Einnahme oder Ausgabe anhand des Vorzeichens bekannt.

Erlaubte Ausgabenkategorien:
${categories.map((category) => `- ${category.id}: ${category.label}`).join('\n')}

Erlaubte Einnahmetypen:
- salary
- sidejob
- freelance
- rental
- investment
- other

Antwortformat:
{
  "entries": [
    {
      "id": "transaktions-id",
      "category": "nur fuer Ausgaben, sonst other",
      "incomeType": "nur fuer Einnahmen, sonst other",
      "description": "verbesserte kurze Beschreibung",
      "note": "optionale Notiz",
      "confidence": 0.0
    }
  ]
}

Transaktionen:
${chunk.map((transaction) => JSON.stringify({
  id: transaction.id,
  direction: transaction.amount >= 0 ? 'income' : 'expense',
  amount: Math.abs(transaction.amount),
  date: transaction.date,
  description: transaction.description,
  counterparty: transaction.counterparty,
  purpose: transaction.purpose,
})).join('\n')}

Regeln:
- Nur valides JSON.
- Fuer Einnahmen incomeType setzen und category auf "other" lassen.
- Fuer Ausgaben eine passende category setzen und incomeType auf "other" lassen.
- Beschreibung nur verbessern, wenn der Vorschlag wirklich klarer ist.
`.trim();

    const raw = await callAIProvider(
      {
        provider: settings.ai.provider,
        model: settings.ai.model,
        apiKey: settings.ai.apiKey,
        endpoint: settings.ai.endpoint,
      },
      prompt
    );

    const payload = extractJsonPayload(raw) as { entries?: Array<Record<string, unknown>> };
    const mapped = (payload.entries || []).map((entry) => ({
      id: String(entry.id || ''),
      category: normalizeCategory(String(entry.category || 'other'), categories),
      incomeType: (['salary', 'sidejob', 'freelance', 'rental', 'investment', 'other'].includes(String(entry.incomeType))
        ? String(entry.incomeType)
        : 'other') as IncomeType,
      confidence: Number.isFinite(Number(entry.confidence)) ? Number(entry.confidence) : undefined,
      description: typeof entry.description === 'string' ? entry.description.trim() : undefined,
      note: typeof entry.note === 'string' ? entry.note.trim() : undefined,
    })).filter((entry) => entry.id);

    results.push(...mapped);
  }

  return transactions.map((transaction) => {
    const aiMatch = results.find((entry) => entry.id === transaction.id);
    if (aiMatch) {
      return aiMatch;
    }

    const local = classifyBankTransactionLocally(transaction);
    return {
      id: transaction.id,
      category: local.category,
      incomeType: local.incomeType,
      confidence: local.confidence,
    };
  });
}
