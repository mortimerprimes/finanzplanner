import type { IncomeType } from '../types';

export interface ParsedBankTransaction {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  counterparty?: string;
  purpose?: string;
  raw: Record<string, string>;
}

export interface LocalBankClassification {
  category: string;
  incomeType: IncomeType;
  confidence: number;
}

const HEADER_ALIASES = {
  date: ['buchungstag', 'buchungsdatum', 'datum', 'valuta', 'valutadatum'],
  amount: ['betrag', 'umsatz', 'wert', 'amount'],
  debitAmount: ['soll', 'belastung', 'debit'],
  creditAmount: ['haben', 'gutschrift', 'credit'],
  currency: ['waehrung', 'wahrung', 'currency'],
  description: ['buchungstext', 'textschluessel', 'textschlussel', 'art', 'buchung'],
  purpose: ['verwendungszweck', 'zweck', 'beschreibung', 'buchungstext2'],
  counterparty: ['zahlungsempfaenger', 'zahlungspflichtiger', 'empfaenger', 'auftraggeber', 'name'],
  creditDebit: ['sollhaben', 'soll/haben', 'soll-haben', 'umsatzart'],
} as const;

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function detectDelimiter(text: string): string {
  const sampleLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 20);
  const sample = sampleLines.join('\n');
  const delimiters = [';', ',', '\t'];
  return delimiters
    .map((delimiter) => ({ delimiter, count: sample.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ';';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, '').trim());
}

function parseGermanAmount(rawValue: string): number {
  const cleaned = rawValue
    .replace(/\uFEFF/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  return Number(cleaned);
}

function parseDate(rawValue: string): string | null {
  const value = rawValue.replace(/\uFEFF/g, '').trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const germanMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    const normalizedYear = year.length === 2 ? `20${year}` : year;
    return `${normalizedYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const normalizedYear = year.length === 2 ? `20${year}` : year;
    return `${normalizedYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

function findColumn(headers: string[], aliases: readonly string[]): string | null {
  for (const alias of aliases) {
    const direct = headers.find((header) => header === alias);
    if (direct) return direct;
  }

  return headers.find((header) => aliases.some((alias) => header.includes(alias))) || null;
}

function detectAmount(
  raw: Record<string, string>,
  amountKey: string | null,
  debitAmountKey: string | null,
  creditAmountKey: string | null,
  creditDebitKey: string | null
): number | null {
  const debitValue = debitAmountKey ? raw[debitAmountKey] : '';
  const creditValue = creditAmountKey ? raw[creditAmountKey] : '';
  const hasDebitCreditColumns = Boolean(debitAmountKey || creditAmountKey);

  if (hasDebitCreditColumns) {
    const debitParsed = debitValue ? parseGermanAmount(debitValue) : 0;
    const creditParsed = creditValue ? parseGermanAmount(creditValue) : 0;
    const debit = Number.isFinite(debitParsed) ? Math.abs(debitParsed) : 0;
    const credit = Number.isFinite(creditParsed) ? Math.abs(creditParsed) : 0;
    if (debit > 0 && credit === 0) return -debit;
    if (credit > 0 && debit === 0) return credit;
    if (debit > 0 && credit > 0) return credit - debit;
  }

  const amountValue = amountKey ? raw[amountKey] : '';
  if (!amountValue) return null;

  const parsed = parseGermanAmount(amountValue);
  if (!Number.isFinite(parsed) || parsed === 0) return null;

  const signHint = creditDebitKey ? raw[creditDebitKey].toLowerCase() : '';
  if (signHint.includes('soll') || signHint.includes('lastschrift') || signHint.includes('debit')) {
    return -Math.abs(parsed);
  }
  if (signHint.includes('haben') || signHint.includes('gutschrift') || signHint.includes('credit')) {
    return Math.abs(parsed);
  }

  return parsed;
}

export function parseBankStatementCsv(text: string): ParsedBankTransaction[] {
  const normalizedText = text.replace(/^\uFEFF/, '');
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const delimiter = detectDelimiter(normalizedText);
  const headerIndex = lines.findIndex((line) => {
    const normalized = normalizeHeader(line);
    return (
      normalized.includes('buchungstag')
      || normalized.includes('buchungsdatum')
      || normalized.includes('valutadatum')
      || normalized.includes('datum')
    ) && (
      normalized.includes('betrag')
      || normalized.includes('umsatz')
      || normalized.includes('soll')
      || normalized.includes('haben')
    );
  });

  const headerLineIndex = headerIndex >= 0 ? headerIndex : 0;
  const hasHeader = headerIndex >= 0;

  if (!hasHeader) {
    return lines.flatMap((line) => {
      const values = parseCsvLine(line, delimiter);
      if (values.length < 4) return [];

      const bookingDate = parseDate(values[0] || '');
      const valueDate = parseDate(values[2] || '');
      const date = bookingDate || valueDate;
      const amount = parseGermanAmount(values[3] || '');
      const description = (values[1] || '').replace(/^"|"$/g, '').trim().slice(0, 180);
      if (!date || !Number.isFinite(amount) || amount === 0 || !description) {
        return [];
      }

      return [{
        id: createId(),
        date,
        amount,
        currency: (values[4] || 'EUR').replace(/^"|"$/g, '').trim() || 'EUR',
        description,
        raw: {
          date: values[0] || '',
          description: values[1] || '',
          valueDate: values[2] || '',
          amount: values[3] || '',
          currency: values[4] || '',
          bookingTimestamp: values[5] || '',
        },
      }];
    });
  }

  const originalHeaders = parseCsvLine(lines[headerLineIndex], delimiter);
  const normalizedHeaders = originalHeaders.map(normalizeHeader);
  const availableHeaders = normalizedHeaders.filter(Boolean);

  const dateKey = findColumn(availableHeaders, HEADER_ALIASES.date);
  const amountKey = findColumn(availableHeaders, HEADER_ALIASES.amount);
  const debitAmountKey = findColumn(availableHeaders, HEADER_ALIASES.debitAmount);
  const creditAmountKey = findColumn(availableHeaders, HEADER_ALIASES.creditAmount);
  const currencyKey = findColumn(availableHeaders, HEADER_ALIASES.currency);
  const descriptionKey = findColumn(availableHeaders, HEADER_ALIASES.description);
  const purposeKey = findColumn(availableHeaders, HEADER_ALIASES.purpose);
  const counterpartyKey = findColumn(availableHeaders, HEADER_ALIASES.counterparty);
  const creditDebitKey = findColumn(availableHeaders, HEADER_ALIASES.creditDebit);

  return lines.slice(headerLineIndex + 1).flatMap((line) => {
    const values = parseCsvLine(line, delimiter);
    const raw = Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, values[index] || ''])
    );

    const date = parseDate((dateKey && raw[dateKey]) || '');
    const amount = detectAmount(raw, amountKey, debitAmountKey, creditAmountKey, creditDebitKey);
    if (!date || amount === null) {
      return [];
    }

    const descriptionParts = [
      descriptionKey ? raw[descriptionKey] : '',
      counterpartyKey ? raw[counterpartyKey] : '',
      purposeKey ? raw[purposeKey] : '',
    ].filter(Boolean);
    const description = descriptionParts.join(' · ').slice(0, 180);
    if (!description) {
      return [];
    }

    return [{
      id: createId(),
      date,
      amount,
      currency: (currencyKey && raw[currencyKey]) || 'EUR',
      description,
      counterparty: counterpartyKey ? raw[counterpartyKey] : undefined,
      purpose: purposeKey ? raw[purposeKey] : undefined,
      raw,
    }];
  });
}

const expenseRules: Array<{ category: string; keywords: string[] }> = [
  { category: 'food', keywords: ['rewe', 'edeka', 'lidl', 'aldi', 'dm', 'rossmann', 'supermarkt'] },
  { category: 'dining', keywords: ['restaurant', 'cafe', 'lieferando', 'mcdonald', 'burger', 'bistro'] },
  { category: 'transport', keywords: ['shell', 'aral', 'jet', 'tank', 'bahn', 'bus', 'uber', 'bolt', 'park'] },
  { category: 'travel', keywords: ['hotel', 'booking', 'airbnb', 'flug', 'ryanair', 'lufthansa', 'urlaub'] },
  { category: 'subscriptions', keywords: ['spotify', 'netflix', 'amazon prime', 'apple.com/bill', 'youtube', 'adobe'] },
  { category: 'shopping', keywords: ['amazon', 'zalando', 'ikea', 'hm', 'h&m', 'media markt', 'saturn'] },
  { category: 'fees', keywords: ['gebuhr', 'gebühr', 'steuer', 'finanzamt', 'kontofuehrung', 'kontoführung'] },
  { category: 'household', keywords: ['obi', 'hornbach', 'bauhaus', 'haushalt', 'miete'] },
  { category: 'health', keywords: ['apotheke', 'arzt', 'zahnarzt', 'krankenhaus'] },
  { category: 'pets', keywords: ['fressnapf', 'tierarzt', 'zooplus'] },
  { category: 'family', keywords: ['kita', 'schule', 'kind', 'familie'] },
  { category: 'work', keywords: ['porto', 'dhl', 'post', 'briefmarke', 'buero', 'büro'] },
];

const incomeRules: Array<{ type: IncomeType; keywords: string[] }> = [
  { type: 'salary', keywords: ['gehalt', 'lohn', 'salary', 'payroll'] },
  { type: 'sidejob', keywords: ['nebenjob', 'minijob'] },
  { type: 'freelance', keywords: ['rechnung', 'honorar', 'freelance', 'projekt'] },
  { type: 'rental', keywords: ['mieteingang', 'mieter', 'rent'] },
  { type: 'investment', keywords: ['dividende', 'zins', 'rendite', 'capital'] },
];

export function classifyBankTransactionLocally(transaction: ParsedBankTransaction): LocalBankClassification {
  const haystack = `${transaction.description} ${transaction.counterparty || ''} ${transaction.purpose || ''}`.toLowerCase();

  if (transaction.amount > 0) {
    const match = incomeRules.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)));
    return {
      category: 'other',
      incomeType: match?.type || 'other',
      confidence: match ? 0.72 : 0.4,
    };
  }

  const match = expenseRules.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)));
  return {
    category: match?.category || 'other',
    incomeType: 'other',
    confidence: match ? 0.72 : 0.35,
  };
}
