import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getFullState, getPrivateBankConnectionDataByConnectionId, saveFullState, setPrivateBankConnectionData } from '@/lib/kv';
import type { Account, BankConnection, BankConnectionProvider, BankConnectionStatus, BankConnectionSyncTarget, FinanceState, SyncSession } from '@/src/types';
import { collectImportedTransactionFingerprints, composeImportedTransactionNote, suggestBankTransactionAssignment, suggestExistingBankTransactionMatch, type ParsedBankTransaction } from '@/src/utils/bankImport';
import { createTransactionFingerprint } from '@/src/utils/transactionFingerprint';

const GOCARDLESS_BASE_URL = process.env.GOCARDLESS_BASE_URL || 'https://bankaccountdata.gocardless.com/api/v2';

const BALANCE_TYPE_PRIORITY = ['interimAvailable', 'interimBooked', 'closingBooked', 'expected'] as const;

interface GoCardlessInstitution {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
  countries?: string[];
}

interface GoCardlessRequisition {
  id: string;
  status?: string;
  institution_id?: string;
  link: string;
  accounts?: string[];
}

interface GoCardlessBalanceResponse {
  balances?: Array<{
    balanceAmount?: {
      amount?: string;
      currency?: string;
    };
    balanceType?: string;
    referenceDate?: string;
    lastChangeDateTime?: string;
  }>;
}

interface GoCardlessTransactionEntry {
  bookingDate?: string;
  valueDate?: string;
  transactionAmount?: {
    amount?: string;
    currency?: string;
  };
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string | string[];
  remittanceInformationStructured?: string | string[];
  additionalInformation?: string;
  bankTransactionCode?: string;
  internalTransactionId?: string;
  transactionId?: string;
}

interface GoCardlessTransactionsResponse {
  transactions?: {
    booked?: GoCardlessTransactionEntry[];
    pending?: GoCardlessTransactionEntry[];
  };
}

interface TradeRepublicWebhookSecret {
  provider: 'trade-republic-webhook';
  tokenHash: string;
  createdAt: string;
}

export interface BankSyncProviderStatus {
  gocardlessConfigured: boolean;
  cronConfigured: boolean;
}

export interface BankSyncInstitutionSummary {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
  country?: string;
}

export interface BankConnectionSyncResult {
  connectionId: string;
  connectionName: string;
  provider: BankConnectionProvider | 'unknown';
  status: 'success' | 'warning' | 'error';
  message: string;
  balance?: number;
  syncedAt?: string;
}

interface SelectedBalance {
  amount: number;
  currency: string;
  asOf: string;
}

interface TransactionImportResult {
  nextState: FinanceState;
  importedCount: number;
  skippedCount: number;
}

function ensureGoCardlessConfig(): void {
  if (!process.env.GOCARDLESS_SECRET_ID || !process.env.GOCARDLESS_SECRET_KEY) {
    throw new Error('GoCardless ist nicht konfiguriert. Bitte GOCARDLESS_SECRET_ID und GOCARDLESS_SECRET_KEY setzen.');
  }
}

function createTradeRepublicToken(): string {
  return `${randomUUID().replace(/-/g, '')}${randomBytes(16).toString('hex')}`;
}

function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getEffectiveSyncTargets(connection: BankConnection): BankConnectionSyncTarget[] {
  const validTargets = (connection.syncTargets || []).filter((target): target is BankConnectionSyncTarget => (
    target === 'balance' || target === 'transactions'
  ));

  return validTargets.length > 0 ? Array.from(new Set(validTargets)) : ['balance'];
}

function resolveProvider(connection: BankConnection): BankConnectionProvider | 'unknown' {
  if (connection.provider) {
    return connection.provider;
  }
  if (connection.bankType === 'elba') {
    return 'manual-elba';
  }
  return 'unknown';
}

function createSyncSession(connectionId: string, input: Omit<SyncSession, 'id' | 'connectionId'>): SyncSession {
  return {
    id: randomUUID(),
    connectionId,
    ...input,
  };
}

function updateConnection(state: FinanceState, connectionId: string, patch: Partial<BankConnection>): FinanceState {
  return {
    ...state,
    bankConnections: state.bankConnections.map((connection) => (
      connection.id === connectionId
        ? { ...connection, ...patch }
        : connection
    )),
  };
}

function appendSyncSession(state: FinanceState, session: SyncSession): FinanceState {
  return {
    ...state,
    syncSessions: [session, ...state.syncSessions].slice(0, 100),
  };
}

function updateAccountBalance(state: FinanceState, accountId: string, balance: number): FinanceState {
  return {
    ...state,
    accounts: state.accounts.map((account) => (
      account.id === accountId
        ? { ...account, balance: roundCurrency(balance) }
        : account
    )),
  };
}

function ensureLinkedCheckingAccount(
  state: FinanceState,
  connection: BankConnection,
  initialBalance: number
): { nextState: FinanceState; accountId: string; created: boolean } {
  if (connection.accountId && state.accounts.some((account) => account.id === connection.accountId)) {
    return {
      nextState: state,
      accountId: connection.accountId,
      created: false,
    };
  }

  const nextAccount: Account = {
    id: randomUUID(),
    name: connection.institutionName || connection.name || 'Bankkonto',
    type: 'checking',
    balance: roundCurrency(initialBalance),
    color: '#0f766e',
    icon: 'Wallet',
    isDefault: state.accounts.length === 0,
    note: 'Automatisch aus Bank-Login erzeugt',
    createdAt: new Date().toISOString(),
  };

  return {
    nextState: {
      ...state,
      accounts: [...state.accounts, nextAccount],
    },
    accountId: nextAccount.id,
    created: true,
  };
}

function updateSingleAccountBalance(state: FinanceState, accountId: string, delta: number): FinanceState {
  return {
    ...state,
    accounts: state.accounts.map((account) => (
      account.id === accountId
        ? { ...account, balance: roundCurrency(account.balance + delta) }
        : account
    )),
  };
}

function normalizePurpose(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(' ').trim();
  }
  return value?.trim() || '';
}

function mapGoCardlessTransaction(entry: GoCardlessTransactionEntry): ParsedBankTransaction | null {
  const date = entry.bookingDate || entry.valueDate;
  const amount = Number(entry.transactionAmount?.amount);
  if (!date || !Number.isFinite(amount)) {
    return null;
  }

  const purpose = normalizePurpose(entry.remittanceInformationUnstructured)
    || normalizePurpose(entry.remittanceInformationStructured)
    || entry.additionalInformation?.trim()
    || '';
  const counterparty = entry.creditorName?.trim() || entry.debtorName?.trim() || undefined;
  const description = [counterparty, purpose || entry.bankTransactionCode]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 180) || 'Automatisch synchronisierte Buchung';

  return {
    id: entry.internalTransactionId || entry.transactionId || randomUUID(),
    date,
    amount,
    currency: entry.transactionAmount?.currency || 'EUR',
    description,
    counterparty,
    purpose: purpose || undefined,
    raw: {
      bookingDate: entry.bookingDate || '',
      valueDate: entry.valueDate || '',
      creditorName: entry.creditorName || '',
      debtorName: entry.debtorName || '',
      purpose,
      bankTransactionCode: entry.bankTransactionCode || '',
    },
  };
}

async function importGoCardlessTransactions(
  state: FinanceState,
  connection: BankConnection,
  accountId: string,
  remoteAccountId: string,
  balanceIsSourceOfTruth: boolean
): Promise<TransactionImportResult> {
  const response = await gocardlessRequest<GoCardlessTransactionsResponse>(`/accounts/${remoteAccountId}/transactions/`, {
    method: 'GET',
  });

  const transactions = (response.transactions?.booked || [])
    .map(mapGoCardlessTransaction)
    .filter((transaction): transaction is ParsedBankTransaction => Boolean(transaction));

  if (transactions.length === 0) {
    return {
      nextState: state,
      importedCount: 0,
      skippedCount: 0,
    };
  }

  let nextState = state;
  let importedCount = 0;
  let skippedCount = 0;
  const existingFingerprints = collectImportedTransactionFingerprints(nextState.expenses, nextState.incomes);
  const importAccountLabel = nextState.accounts.find((account) => account.id === accountId)?.name;
  const sourceLabel = `${connection.institutionName || connection.name} Auto-Sync`;

  for (const transaction of transactions) {
    const fingerprint = createTransactionFingerprint(
      transaction.date,
      transaction.amount,
      transaction.description,
      [transaction.counterparty, transaction.purpose]
    );

    if (existingFingerprints.has(fingerprint)) {
      skippedCount += 1;
      continue;
    }

    existingFingerprints.add(fingerprint);
    const assignment = suggestBankTransactionAssignment(transaction, {
      defaultAccountId: accountId,
      categoryRules: nextState.categoryRules,
      accountRules: nextState.accountRules,
    });
    const resolvedAccountId = assignment.accountId || accountId;
    const existingMatch = suggestExistingBankTransactionMatch(transaction, {
      accountId: resolvedAccountId,
      fixedExpenses: nextState.fixedExpenses,
      incomes: nextState.incomes,
      debts: nextState.debts,
    });
    const importNote = composeImportedTransactionNote(transaction.purpose, importAccountLabel, sourceLabel);
    const affectsAccountBalance = !balanceIsSourceOfTruth;

    if (transaction.amount < 0) {
      const amount = Math.abs(transaction.amount);
      nextState = {
        ...nextState,
        expenses: [...nextState.expenses, {
          id: randomUUID(),
          description: transaction.description,
          amount,
          category: assignment.category,
          date: transaction.date,
          month: transaction.date.slice(0, 7),
          note: importNote,
          accountId: resolvedAccountId,
          linkedDebtId: existingMatch.type === 'debt' ? existingMatch.targetId || undefined : undefined,
          bankImportMatch: existingMatch.type === 'fixedExpense' && existingMatch.targetId
            ? { type: 'fixedExpense', targetId: existingMatch.targetId }
            : undefined,
          tags: ['banksync', 'provider-sync'],
          affectsAccountBalance,
          createdAt: new Date().toISOString(),
        }],
      };
      if (affectsAccountBalance && resolvedAccountId) {
        nextState = updateSingleAccountBalance(nextState, resolvedAccountId, -amount);
      }
    } else {
      const amount = Math.abs(transaction.amount);
      nextState = {
        ...nextState,
        incomes: [...nextState.incomes, {
          id: randomUUID(),
          name: transaction.description,
          amount,
          type: assignment.incomeType,
          isRecurring: false,
          date: transaction.date,
          month: transaction.date.slice(0, 7),
          note: importNote,
          accountId: resolvedAccountId,
          affectsAccountBalance,
          bankImportMatch: existingMatch.type === 'recurringIncome' && existingMatch.targetId
            ? { type: 'recurringIncome', targetId: existingMatch.targetId }
            : undefined,
          createdAt: new Date().toISOString(),
        }],
      };
      if (affectsAccountBalance && resolvedAccountId) {
        nextState = updateSingleAccountBalance(nextState, resolvedAccountId, amount);
      }
    }

    importedCount += 1;
  }

  return {
    nextState,
    importedCount,
    skippedCount,
  };
}

async function getGoCardlessAccessToken(): Promise<string> {
  ensureGoCardlessConfig();

  const response = await fetch(`${GOCARDLESS_BASE_URL}/token/new/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      secret_id: process.env.GOCARDLESS_SECRET_ID,
      secret_key: process.env.GOCARDLESS_SECRET_KEY,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GoCardless Token konnte nicht erstellt werden (${response.status}): ${details}`);
  }

  const data = await response.json() as { access?: string };
  if (!data.access) {
    throw new Error('GoCardless hat kein Access-Token geliefert.');
  }

  return data.access;
}

async function gocardlessRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getGoCardlessAccessToken();
  const response = await fetch(`${GOCARDLESS_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GoCardless Anfrage fehlgeschlagen (${response.status}): ${details}`);
  }

  return response.json() as Promise<T>;
}

function selectPreferredBalance(entries: GoCardlessBalanceResponse['balances']): SelectedBalance | null {
  const validEntries = (entries || []).filter((entry) => entry.balanceAmount?.amount && entry.balanceAmount?.currency);
  if (validEntries.length === 0) {
    return null;
  }

  const sorted = [...validEntries].sort((left, right) => {
    const leftPriority = BALANCE_TYPE_PRIORITY.indexOf((left.balanceType || '') as (typeof BALANCE_TYPE_PRIORITY)[number]);
    const rightPriority = BALANCE_TYPE_PRIORITY.indexOf((right.balanceType || '') as (typeof BALANCE_TYPE_PRIORITY)[number]);
    const safeLeft = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority;
    const safeRight = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority;
    return safeLeft - safeRight;
  });

  const selected = sorted[0];
  const amount = Number(selected.balanceAmount?.amount);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return {
    amount,
    currency: selected.balanceAmount?.currency || 'EUR',
    asOf: selected.referenceDate || selected.lastChangeDateTime || new Date().toISOString(),
  };
}

function deriveErrorStatus(message: string): BankConnectionStatus {
  if (/expired|requisition|consent|authori|login|not found/i.test(message)) {
    return 'needsReauth';
  }
  return 'error';
}

async function runGoCardlessSync(state: FinanceState, connection: BankConnection): Promise<{ nextState: FinanceState; result: BankConnectionSyncResult }> {
  const syncTargets = getEffectiveSyncTargets(connection);
  if (syncTargets.length === 0 || !connection.autoSyncEnabled) {
    return {
      nextState: state,
      result: {
        connectionId: connection.id,
        connectionName: connection.name,
        provider: resolveProvider(connection),
        status: 'warning',
        message: 'Für diese Verbindung ist derzeit kein Synchronisationsziel aktiv.',
      },
    };
  }

  if (!connection.requisitionId) {
    throw new Error('Für diese GoCardless-Verbindung fehlt die Requisition-ID.');
  }

  const requisition = await gocardlessRequest<GoCardlessRequisition>(`/requisitions/${connection.requisitionId}/`, {
    method: 'GET',
  });
  const remoteAccountIds = requisition.accounts || [];

  if (remoteAccountIds.length === 0) {
    const message = 'Die Bankfreigabe ist noch nicht abgeschlossen oder liefert noch keine Konten.';
    return {
      nextState: updateConnection(state, connection.id, {
        providerStatus: 'pending',
        lastSyncError: message,
      }),
      result: {
        connectionId: connection.id,
        connectionName: connection.name,
        provider: resolveProvider(connection),
        status: 'warning',
        message,
      },
    };
  }

  const remoteAccountId = connection.remoteAccountId || remoteAccountIds[0];
  const balanceResponse = await gocardlessRequest<GoCardlessBalanceResponse>(`/accounts/${remoteAccountId}/balances/`, {
    method: 'GET',
  });
  const selectedBalance = selectPreferredBalance(balanceResponse.balances);
  if (!selectedBalance) {
    throw new Error('GoCardless hat keinen verwertbaren Kontostand geliefert.');
  }

  const syncedAt = new Date().toISOString();
  const initialAccountBalance = syncTargets.includes('balance') ? selectedBalance.amount : 0;
  const linkedAccount = ensureLinkedCheckingAccount(state, connection, initialAccountBalance);
  let nextState = linkedAccount.nextState;
  let importedCount = 0;
  let skippedCount = 0;
  const statusMessages: string[] = [];

  if (syncTargets.includes('balance')) {
    nextState = updateAccountBalance(nextState, linkedAccount.accountId, selectedBalance.amount);
    statusMessages.push(`Kontostand ${selectedBalance.currency} ${roundCurrency(selectedBalance.amount).toFixed(2)} aktualisiert`);
  }

  if (syncTargets.includes('transactions')) {
    const imported = await importGoCardlessTransactions(
      nextState,
      connection,
      linkedAccount.accountId,
      remoteAccountId,
      syncTargets.includes('balance')
    );
    nextState = imported.nextState;
    importedCount = imported.importedCount;
    skippedCount = imported.skippedCount;
    statusMessages.push(`Umsätze importiert ${importedCount}${skippedCount > 0 ? `, Duplikate übersprungen ${skippedCount}` : ''}`);
  }

  const totalTransactionCount = (syncTargets.includes('balance') ? 1 : 0) + importedCount + skippedCount;
  nextState = updateConnection(nextState, connection.id, {
    accountId: linkedAccount.accountId,
    providerStatus: 'active',
    remoteAccountId,
    remoteAccountIds,
    lastBalance: syncTargets.includes('balance') ? roundCurrency(selectedBalance.amount) : connection.lastBalance,
    lastBalanceCurrency: syncTargets.includes('balance') ? selectedBalance.currency : connection.lastBalanceCurrency,
    lastBalanceAt: syncTargets.includes('balance') ? selectedBalance.asOf : connection.lastBalanceAt,
    lastSyncAt: syncedAt,
    lastSyncCount: importedCount + (syncTargets.includes('balance') ? 1 : 0),
    lastSyncError: undefined,
  });
  nextState = appendSyncSession(nextState, createSyncSession(connection.id, {
    syncedAt,
    fileName: `${connection.institutionName || connection.name} · Auto-Sync`,
    transactionCount: totalTransactionCount,
    newCount: importedCount + (syncTargets.includes('balance') ? 1 : 0),
    skippedCount,
    source: 'provider-pull',
    status: 'success',
    message: `${linkedAccount.created ? 'Lokales Konto automatisch angelegt. ' : ''}${statusMessages.join(' · ')}.`,
  }));

  return {
    nextState,
    result: {
      connectionId: connection.id,
      connectionName: connection.name,
      provider: resolveProvider(connection),
      status: 'success',
      message: `${linkedAccount.created ? 'Lokales Konto automatisch erstellt. ' : ''}${statusMessages.join(' · ')}.`,
      balance: syncTargets.includes('balance') ? roundCurrency(selectedBalance.amount) : undefined,
      syncedAt,
    },
  };
}

export function getBankSyncProviderStatus(): BankSyncProviderStatus {
  return {
    gocardlessConfigured: Boolean(process.env.GOCARDLESS_SECRET_ID && process.env.GOCARDLESS_SECRET_KEY),
    cronConfigured: Boolean(process.env.BANK_SYNC_CRON_SECRET),
  };
}

export async function searchGoCardlessInstitutions(country: string, query: string): Promise<BankSyncInstitutionSummary[]> {
  ensureGoCardlessConfig();
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedCountry) {
    return [];
  }

  const institutions = await gocardlessRequest<GoCardlessInstitution[]>(`/institutions/?country=${encodeURIComponent(normalizedCountry)}`, {
    method: 'GET',
  });

  return institutions
    .filter((institution) => institution.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 12)
    .map((institution) => ({
      id: institution.id,
      name: institution.name,
      bic: institution.bic,
      logo: institution.logo,
      country: institution.countries?.[0] || normalizedCountry,
    }));
}

export async function createGoCardlessConnection(userId: string, input: {
  connectionName?: string;
  accountId?: string;
  syncTargets?: BankConnectionSyncTarget[];
  institutionId: string;
  institutionName: string;
  redirectUrl: string;
}): Promise<{ state: FinanceState; connection: BankConnection; redirectUrl: string }> {
  ensureGoCardlessConfig();

  const connectionId = randomUUID();
  const reference = `fp-${connectionId}`;
  const requisition = await gocardlessRequest<GoCardlessRequisition>('/requisitions/', {
    method: 'POST',
    body: JSON.stringify({
      redirect: input.redirectUrl,
      institution_id: input.institutionId,
      reference,
      user_language: 'DE',
    }),
  });

  const state = await getFullState(userId);
  const connection: BankConnection = {
    id: connectionId,
    name: input.connectionName?.trim() || input.institutionName.trim(),
    bankType: 'gocardless',
    provider: 'gocardless',
    syncMode: 'provider-pull',
    providerStatus: 'pending',
    accountId: input.accountId,
    institutionId: input.institutionId,
    institutionName: input.institutionName,
    autoSyncEnabled: true,
    syncTargets: input.syncTargets?.length ? input.syncTargets : ['balance'],
    syncFrequency: 'daily',
    requisitionId: requisition.id,
    callbackReference: reference,
    createdAt: new Date().toISOString(),
  };

  const nextState = {
    ...state,
    bankConnections: [...state.bankConnections, connection],
  };
  await saveFullState(userId, nextState);

  return {
    state: nextState,
    connection,
    redirectUrl: requisition.link,
  };
}

export async function createTradeRepublicWebhookConnection(userId: string, input: {
  connectionName: string;
  accountId: string;
  webhookBaseUrl: string;
}): Promise<{ state: FinanceState; connection: BankConnection; token: string; webhookUrl: string }> {
  const state = await getFullState(userId);
  const connection: BankConnection = {
    id: randomUUID(),
    name: input.connectionName.trim(),
    bankType: 'tradeRepublic',
    provider: 'trade-republic-webhook',
    syncMode: 'provider-push',
    providerStatus: 'pending',
    institutionName: 'Trade Republic',
    accountId: input.accountId,
    autoSyncEnabled: true,
    syncTargets: ['balance'],
    syncFrequency: 'daily',
    createdAt: new Date().toISOString(),
  };

  const nextState = {
    ...state,
    bankConnections: [...state.bankConnections, connection],
  };
  await saveFullState(userId, nextState);

  const token = createTradeRepublicToken();
  await setPrivateBankConnectionData<TradeRepublicWebhookSecret>(userId, connection.id, {
    provider: 'trade-republic-webhook',
    tokenHash: hashSecret(token),
    createdAt: new Date().toISOString(),
  });

  return {
    state: nextState,
    connection,
    token,
    webhookUrl: `${input.webhookBaseUrl.replace(/\/$/, '')}/${connection.id}`,
  };
}

export async function syncBankConnectionsForUser(userId: string, connectionId?: string): Promise<{ state: FinanceState; results: BankConnectionSyncResult[] }> {
  let state = await getFullState(userId);
  const targets = state.bankConnections.filter((connection) => (
    connectionId
      ? connection.id === connectionId
      : connection.autoSyncEnabled && connection.provider === 'gocardless'
  ));

  const results: BankConnectionSyncResult[] = [];
  for (const connection of targets) {
    try {
      if (resolveProvider(connection) !== 'gocardless') {
        results.push({
          connectionId: connection.id,
          connectionName: connection.name,
          provider: resolveProvider(connection),
          status: 'warning',
          message: 'Diese Verbindung aktualisiert sich per Push/Webhook und kann nicht aktiv abgefragt werden.',
        });
        continue;
      }

      const syncResult = await runGoCardlessSync(state, connection);
      state = syncResult.nextState;
      results.push(syncResult.result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Sync-Fehler';
      state = updateConnection(state, connection.id, {
        providerStatus: deriveErrorStatus(message),
        lastSyncError: message,
      });
      results.push({
        connectionId: connection.id,
        connectionName: connection.name,
        provider: resolveProvider(connection),
        status: 'error',
        message,
      });
    }
  }

  await saveFullState(userId, state);
  return { state, results };
}

export async function ingestTradeRepublicBalance(connectionId: string, bearerToken: string | null, payload: {
  balance: number;
  currency?: string;
  capturedAt?: string;
  note?: string;
}): Promise<{ state: FinanceState; result: BankConnectionSyncResult }> {
  if (!bearerToken) {
    throw new Error('Authorization Bearer Token fehlt.');
  }

  const owner = await getPrivateBankConnectionDataByConnectionId<TradeRepublicWebhookSecret>(connectionId);
  if (!owner?.data || owner.data.provider !== 'trade-republic-webhook') {
    throw new Error('Keine Trade-Republic-Verbindung für diesen Webhook gefunden.');
  }

  if (owner.data.tokenHash !== hashSecret(bearerToken)) {
    throw new Error('Ungültiger Webhook-Token.');
  }

  const state = await getFullState(owner.userId);
  const connection = state.bankConnections.find((item) => item.id === connectionId);
  if (!connection) {
    throw new Error('Die zugehörige Bankverbindung existiert nicht mehr.');
  }

  if (!connection.autoSyncEnabled || !getEffectiveSyncTargets(connection).includes('balance')) {
    return {
      state,
      result: {
        connectionId: connection.id,
        connectionName: connection.name,
        provider: resolveProvider(connection),
        status: 'warning',
        message: 'Kontostand-Sync ist für diese Verbindung deaktiviert.',
      },
    };
  }

  if (!connection.accountId) {
    throw new Error('Der Trade-Republic-Verbindung ist kein lokales Zielkonto zugeordnet.');
  }

  const syncedAt = new Date().toISOString();
  let nextState = updateAccountBalance(state, connection.accountId, payload.balance);
  nextState = updateConnection(nextState, connection.id, {
    providerStatus: 'active',
    lastBalance: roundCurrency(payload.balance),
    lastBalanceCurrency: payload.currency || 'EUR',
    lastBalanceAt: payload.capturedAt || syncedAt,
    lastSyncAt: syncedAt,
    lastSyncCount: 1,
    lastSyncError: undefined,
  });
  nextState = appendSyncSession(nextState, createSyncSession(connection.id, {
    syncedAt,
    fileName: 'Trade Republic Webhook',
    transactionCount: 1,
    newCount: 1,
    skippedCount: 0,
    source: 'provider-push',
    status: 'success',
    message: payload.note || 'Trade Republic Kontostand per Webhook aktualisiert.',
  }));
  await saveFullState(owner.userId, nextState);

  return {
    state: nextState,
    result: {
      connectionId: connection.id,
      connectionName: connection.name,
      provider: resolveProvider(connection),
      status: 'success',
      message: 'Trade Republic Kontostand aktualisiert.',
      balance: roundCurrency(payload.balance),
      syncedAt,
    },
  };
}