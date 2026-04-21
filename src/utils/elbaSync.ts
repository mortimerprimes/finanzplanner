/**
 * ELBA Bank Sync Utilities
 *
 * Supports:
 *  - Raiffeisen ELBA CSV exports (Austrian/German format)
 *  - MT940 SWIFT statement format (universal bank format)
 *  - Generic CSV (fallback, same logic as bankImport.ts but ELBA-aware)
 *
 * Key feature: transaction fingerprinting for duplicate-free re-imports.
 */

import { parseBankStatementCsv, classifyBankTransactionLocally, type ParsedBankTransaction } from './bankImport';
import { createTransactionFingerprint } from './transactionFingerprint';
import type { IncomeType, ExpenseCategory } from '../types';

// ─── Hash Storage ───────────────────────────────────────────────────────────
const HASH_STORAGE_KEY = 'finanzplanner_sync_hashes';

function loadStoredHashes(): Set<string> {
  try {
    const raw = localStorage.getItem(HASH_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function saveImportedHashes(hashes: string[]): void {
  const existing = loadStoredHashes();
  hashes.forEach((h) => existing.add(h));
  localStorage.setItem(HASH_STORAGE_KEY, JSON.stringify([...existing]));
}

export function getStoredHashCount(): number {
  return loadStoredHashes().size;
}

/**
 * Creates a stable fingerprint for a bank transaction.
 * Same transaction imported twice produces the same hash → automatic deduplication.
 */
export function hashTransaction(date: string, amount: number, description: string): string {
  return createTransactionFingerprint(date, amount, description);
}

// ─── MT940 Parser ────────────────────────────────────────────────────────────

/**
 * Parses MT940 SWIFT format bank statements.
 * ELBA (Raiffeisen) exports MT940 via "Kontoauszug herunterladen → MT940".
 */
export function parseMT940(text: string): ParsedBankTransaction[] {
  const transactions: ParsedBankTransaction[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith(':61:')) {
      // :61: value-date, booking-date, debit/credit, amount, swift-code, reference
      // Format: :61:VVMMTTBBDDDDDDDDNREFERENZ
      // e.g.   :61:2604010401D100,00NTRFNONREF
      const body = line.slice(4).trim();

      // Date: first 6 chars = YYMMDD (value date), next optional 4 = MMDD booking date
      const dateMatch = body.match(/^(\d{2})(\d{2})(\d{2})(\d{4})?/);
      if (!dateMatch) { i++; continue; }
      const [, yy, mm, dd] = dateMatch;
      const date = `20${yy}-${mm}-${dd}`;

      // Debit/Credit indicator
      const remainder = body.slice(dateMatch[0].length);
      const dcMatch = remainder.match(/^(C|D|RD|RC)(\d[\d,]+)/);
      if (!dcMatch) { i++; continue; }
      const isDebit = dcMatch[1] === 'D' || dcMatch[1] === 'RD';
      const rawAmt = dcMatch[2].replace(',', '.');
      const amount = isDebit ? -parseFloat(rawAmt) : parseFloat(rawAmt);

      // Collect :86: narrative line(s)
      let narrative = '';
      let j = i + 1;
      while (j < lines.length && lines[j].startsWith(':86:')) {
        narrative += lines[j].slice(4) + ' ';
        j++;
        // MT940 continuation lines start with a space or have no tag prefix
        while (j < lines.length && !lines[j].startsWith(':') && lines[j].trim()) {
          narrative += lines[j].trim() + ' ';
          j++;
        }
      }
      narrative = narrative.trim();

      // Parse ELBA-style narrative sub-fields (?20, ?21 … purpose, ?32 counterparty)
      const subFields = parseMT940Narrative(narrative);

      transactions.push({
        id: `mt940-${Date.now()}-${transactions.length}`,
        date,
        amount,
        currency: 'EUR',
        description: buildDescription(subFields),
        counterparty: subFields.counterparty,
        purpose: subFields.purpose,
        raw: { narrative },
      });

      i = j;
    } else {
      i++;
    }
  }

  return transactions;
}

interface MT940SubFields {
  transactionCode?: string;
  purpose?: string;
  counterparty?: string;
  iban?: string;
  bic?: string;
}

function parseMT940Narrative(text: string): MT940SubFields {
  // SEPA sub-fields: ?00 = booking text, ?20-?29 = purpose, ?32-?33 = name, ?34 = IBAN
  const fields: Record<string, string> = {};
  const matches = text.matchAll(/\?(\d{2})([^?]*)/g);
  for (const m of matches) {
    fields[m[1]] = m[2].trim();
  }

  const purposeParts = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 60, 61, 62, 63]
    .map((n) => fields[String(n).padStart(2, '0')])
    .filter(Boolean)
    .join(' ')
    .trim();

  const counterparty = [fields['32'], fields['33']].filter(Boolean).join(' ').trim();
  const iban = fields['31'] || fields['34'] || undefined;
  const bic = fields['30'] || undefined;

  // If no SEPA sub-fields, treat whole text as purpose
  const purpose = purposeParts || (Object.keys(fields).length === 0 ? text.slice(0, 120) : undefined);

  return {
    transactionCode: fields['00'],
    purpose: purpose || undefined,
    counterparty: counterparty || undefined,
    iban,
    bic,
  };
}

function buildDescription(fields: MT940SubFields): string {
  const parts = [
    fields.transactionCode,
    fields.counterparty,
    fields.purpose,
  ].filter(Boolean);
  return parts.join(' · ').slice(0, 180) || 'Unbekannte Buchung';
}

// ─── ELBA-specific CSV header hints ──────────────────────────────────────────

/** Additional ELBA-specific column aliases not in the generic bankImport.ts */
const ELBA_EXTRA_ALIASES = [
  'auftraggeber/zahlungsempfanger',
  'zahlungsempfanger',
  'auftraggeber',
  'beguenstigter/zahlungspflichtiger',
  'empfanger',
];

/**
 * Returns true if the CSV looks like it came from Raiffeisen ELBA.
 */
export function isElbaFormat(firstLine: string): boolean {
  const normalized = firstLine.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    normalized.includes('buchungstag') ||
    normalized.includes('valutadatum') ||
    normalized.includes('auftraggeber') ||
    ELBA_EXTRA_ALIASES.some((alias) => normalized.includes(alias))
  );
}

// ─── Unified import entry point ───────────────────────────────────────────────

export type SyncFileType = 'elba-csv' | 'mt940' | 'generic-csv' | 'unknown';

export interface SyncTransaction extends ParsedBankTransaction {
  fingerprint: string;
  isDuplicate: boolean;
  suggestedCategory: ExpenseCategory;
  suggestedIncomeType: IncomeType;
  classificationConfidence: number;
}

export interface SyncParseResult {
  fileType: SyncFileType;
  transactions: SyncTransaction[];
  duplicateCount: number;
  newCount: number;
}

/**
 * Parse a file (CSV or MT940 text), detect duplicates, and pre-classify each transaction.
 */
export function parseSyncFile(text: string, fileName: string): SyncParseResult {
  const storedHashes = loadStoredHashes();

  // Detect file type
  let fileType: SyncFileType = 'unknown';
  let raw: ParsedBankTransaction[] = [];

  const trimmed = text.trim();
  const firstLine = trimmed.split(/\r?\n/)[0] || '';

  if (fileName.toLowerCase().endsWith('.mt940') || fileName.toLowerCase().endsWith('.sta') || trimmed.startsWith(':20:')) {
    fileType = 'mt940';
    raw = parseMT940(trimmed);
  } else if (fileName.toLowerCase().endsWith('.csv') || firstLine.includes(';') || firstLine.includes(',')) {
    fileType = isElbaFormat(firstLine) ? 'elba-csv' : 'generic-csv';
    raw = parseBankStatementCsv(trimmed);
  }

  const transactions: SyncTransaction[] = raw.map((tx) => {
    const fingerprint = createTransactionFingerprint(tx.date, tx.amount, tx.description, [tx.counterparty, tx.purpose]);
    const classification = classifyBankTransactionLocally(tx);
    return {
      ...tx,
      fingerprint,
      isDuplicate: storedHashes.has(fingerprint),
      suggestedCategory: classification.category as ExpenseCategory,
      suggestedIncomeType: classification.incomeType,
      classificationConfidence: classification.confidence,
    };
  });

  const duplicateCount = transactions.filter((t) => t.isDuplicate).length;
  const newCount = transactions.length - duplicateCount;

  return { fileType, transactions, duplicateCount, newCount };
}
