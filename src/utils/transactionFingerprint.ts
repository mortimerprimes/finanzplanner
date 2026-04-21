function normalizeFingerprintSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function createTransactionFingerprint(
  date: string,
  amount: number,
  description: string,
  extraDetails: Array<string | undefined> = []
): string {
  const normalized = [
    date,
    amount.toFixed(2),
    normalizeFingerprintSegment(description),
    ...extraDetails
      .map((detail) => normalizeFingerprintSegment(detail || ''))
      .filter(Boolean),
  ].join('|');

  let hash = 5381;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 33) ^ normalized.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}