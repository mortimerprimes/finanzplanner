import type { FinanceState } from '../types';

const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services';
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GOOGLE_DRIVE_FOLDER_NAME = 'Finanzplanner Backups';
const GOOGLE_DRIVE_LIVE_FILE_NAME = 'finanzplanner-live-backup.json';
const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const GOOGLE_DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3/files';
const GOOGLE_AUTH_INTERACTIVE_TIMEOUT_MS = 60_000;
const GOOGLE_AUTH_SILENT_TIMEOUT_MS = 15_000;

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenError = {
  type?: string;
};

type GoogleTokenClientConfig = {
  client_id: string;
  scope: string;
  prompt?: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: GoogleTokenError) => void;
};

type GoogleTokenClient = {
  requestAccessToken: () => void;
};

type DriveFile = {
  id: string;
  name: string;
  createdTime: string;
  modifiedTime?: string;
  size?: string;
};

type DriveListResponse = {
  files?: DriveFile[];
};

type DriveFolderResponse = {
  id: string;
  name: string;
};

type GoogleApiWindow = Window & typeof globalThis & {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
      };
    };
  };
};

export interface GoogleDriveBackupResult {
  fileId: string;
  fileName: string;
  folderId: string;
  timestamp: string;
}

export interface GoogleDriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: number;
}

export interface GoogleDriveAuthDiagnostics {
  origin: string;
  issues: string[];
}

export function createGoogleDriveBackupPayload(state: FinanceState): string {
  const exportableState: FinanceState = {
    ...state,
    settings: {
      ...state.settings,
      googleDrive: {
        clientId: '',
        folderId: '',
        lastBackupAt: '',
        lastBackupFileId: '',
        lastBackupFileName: '',
        liveSyncFileId: '',
        liveSyncFileName: '',
        lastLiveSyncAt: '',
      },
      localFolder: {
        directoryName: '',
        lastBackupAt: '',
        lastBackupFileName: '',
        liveSyncFileName: '',
        lastLiveSyncAt: '',
      },
    },
  };

  return JSON.stringify(exportableState);
}

export function shouldRunGoogleDriveAutoBackup(
  frequency: FinanceState['settings']['backupFrequency'],
  lastBackupAt?: string
): boolean {
  if (frequency === 'manual') return false;
  if (frequency === 'live') return true;
  if (!lastBackupAt) return true;

  const lastBackup = new Date(lastBackupAt).getTime();
  if (Number.isNaN(lastBackup)) return true;

  const now = Date.now();
  const interval = frequency === 'weekly'
    ? 7 * 24 * 60 * 60 * 1000
    : 30 * 24 * 60 * 60 * 1000;

  return now - lastBackup >= interval;
}

function getGoogleWindow(): GoogleApiWindow {
  return window as GoogleApiWindow;
}

function isAllowedGoogleOAuthOrigin(origin: string): boolean {
  if (origin.startsWith('https://')) {
    return true;
  }

  return origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
}

function formatGoogleAuthStartError(errorType?: string, interactive = true): string {
  if (errorType === 'popup_failed_to_open') {
    return 'Google-Popup konnte nicht geoeffnet werden. Bitte Popups fuer diese Seite erlauben und erneut versuchen.';
  }

  if (errorType === 'popup_closed') {
    return interactive
      ? 'Google-Anmeldung wurde geschlossen, bevor sie abgeschlossen werden konnte.'
      : 'Die gespeicherte Google-Verbindung ist nicht mehr aktiv. Bitte Google Drive erneut verbinden.';
  }

  return interactive
    ? 'Google-Anmeldung konnte nicht gestartet werden. Bitte Popups, Cookies und die Google-OAuth-Freigaben fuer diese Adresse pruefen.'
    : 'Die automatische Google-Drive-Sicherung konnte nicht gestartet werden. Bitte Google Drive erneut verbinden.';
}

function formatGoogleTokenError(response: GoogleTokenResponse, interactive: boolean): string {
  if (response.error === 'popup_closed') {
    return interactive
      ? 'Google-Anmeldung wurde vorzeitig geschlossen.'
      : 'Die gespeicherte Google-Verbindung ist nicht mehr aktiv. Bitte Google Drive erneut verbinden.';
  }

  if (response.error === 'access_denied') {
    return 'Google hat den Zugriff abgelehnt. Bitte die Testnutzer-Freigabe und die OAuth-Konfiguration pruefen.';
  }

  return response.error_description || response.error || 'Google Drive Zugriff wurde nicht gewaehrt.';
}

export async function inspectGoogleDriveAuthSetup(clientId: string): Promise<GoogleDriveAuthDiagnostics> {
  const issues: string[] = [];
  const origin = window.location.origin;

  if (!clientId.trim()) {
    issues.push('Bitte zuerst eine Google Client-ID hinterlegen.');
  }

  if (!isAllowedGoogleOAuthOrigin(origin)) {
    issues.push(`Google OAuth braucht HTTPS oder localhost. Aktuelle Adresse: ${origin}`);
  }

  try {
    await loadGoogleIdentityScript();
  } catch (error) {
    issues.push(error instanceof Error ? error.message : 'Google Identity Services konnte nicht geladen werden.');
  }

  return { origin, issues };
}

async function loadGoogleIdentityScript(): Promise<void> {
  const googleWindow = getGoogleWindow();
  if (googleWindow.google?.accounts?.oauth2) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_IDENTITY_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Identity Services konnte nicht geladen werden.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services konnte nicht geladen werden.'));
    document.head.appendChild(script);
  });
}

async function requestGoogleAccessToken(clientId: string, interactive: boolean): Promise<string> {
  if (!clientId.trim()) {
    throw new Error('Bitte zuerst eine Google Client-ID hinterlegen.');
  }

  const origin = window.location.origin;
  if (!isAllowedGoogleOAuthOrigin(origin)) {
    throw new Error(`Google OAuth braucht HTTPS oder localhost. Aktuelle Adresse: ${origin}`);
  }

  await loadGoogleIdentityScript();
  const googleWindow = getGoogleWindow();
  const initTokenClient = googleWindow.google?.accounts?.oauth2?.initTokenClient;
  if (!initTokenClient) {
    throw new Error('Google OAuth konnte nicht initialisiert werden.');
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finalize = (handler: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      handler();
    };
    const timeoutId = window.setTimeout(() => {
      finalize(() => {
        reject(new Error(
          interactive
            ? 'Google-Anmeldung hat zu lange gedauert. Bitte erneut versuchen und darauf achten, dass das Popup offen bleibt.'
            : 'Die automatische Google-Drive-Verbindung ist abgelaufen. Bitte Google Drive erneut verbinden.'
        ));
      });
    }, interactive ? GOOGLE_AUTH_INTERACTIVE_TIMEOUT_MS : GOOGLE_AUTH_SILENT_TIMEOUT_MS);
    const client = initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      prompt: interactive ? 'consent' : '',
      callback: (response) => {
        finalize(() => {
          if (response.error || !response.access_token) {
            reject(new Error(formatGoogleTokenError(response, interactive)));
            return;
          }
          resolve(response.access_token);
        });
      },
      error_callback: (error) => {
        finalize(() => {
          reject(new Error(formatGoogleAuthStartError(error.type, interactive)));
        });
      },
    });

    try {
      client.requestAccessToken();
    } catch (error) {
      finalize(() => {
        reject(new Error(
          error instanceof Error
            ? `${formatGoogleAuthStartError(undefined, interactive)} Details: ${error.message}`
            : formatGoogleAuthStartError(undefined, interactive)
        ));
      });
    }
  });
}

async function googleDriveRequest<T>(accessToken: string, input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Google Drive Anfrage fehlgeschlagen.');
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

async function ensureBackupFolder(accessToken: string, folderId?: string): Promise<string> {
  if (folderId) {
    return folderId;
  }

  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name = '${GOOGLE_DRIVE_FOLDER_NAME}' and trashed = false`
  );
  const existing = await googleDriveRequest<DriveListResponse>(
    accessToken,
    `${GOOGLE_DRIVE_API_BASE}/files?q=${query}&pageSize=1&fields=files(id,name)`
  );

  const foundFolder = existing.files?.[0];
  if (foundFolder) {
    return foundFolder.id;
  }

  const createdFolder = await googleDriveRequest<DriveFolderResponse>(accessToken, `${GOOGLE_DRIVE_API_BASE}/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: GOOGLE_DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: {
        app: 'finanzplanner',
      },
    }),
  });

  return createdFolder.id;
}

function createBackupFileName(date = new Date()): string {
  return `finanzplanner-backup-${date.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
}

function createMultipartBody(
  metadata: Record<string, unknown>,
  payload: string,
  boundary: string
): string {
  return `--${boundary}\r\n`
    + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
    + `${JSON.stringify(metadata)}\r\n`
    + `--${boundary}\r\n`
    + 'Content-Type: application/json\r\n\r\n'
    + `${payload}\r\n`
    + `--${boundary}--`;
}

async function findBackupFileByName(accessToken: string, folderId: string, fileName: string): Promise<DriveFile | null> {
  const query = encodeURIComponent(`'${folderId}' in parents and name = '${fileName}' and trashed = false`);
  const response = await googleDriveRequest<DriveListResponse>(
    accessToken,
    `${GOOGLE_DRIVE_API_BASE}/files?q=${query}&pageSize=1&fields=files(id,name,createdTime,modifiedTime,size)`
  );
  return response.files?.[0] || null;
}

export async function performGoogleDriveBackup(
  state: FinanceState,
  options: {
    clientId: string;
    folderId?: string;
    interactive?: boolean;
  }
): Promise<GoogleDriveBackupResult> {
  const accessToken = await requestGoogleAccessToken(options.clientId, options.interactive !== false);
  const resolvedFolderId = await ensureBackupFolder(accessToken, options.folderId);
  const fileName = createBackupFileName();
  const payload = createGoogleDriveBackupPayload(state);
  const boundary = `finanzplanner-${Date.now()}`;
  const body = createMultipartBody({
    name: fileName,
    parents: [resolvedFolderId],
    mimeType: 'application/json',
    appProperties: {
      app: 'finanzplanner',
      type: 'backup',
    },
  }, payload, boundary);

  const uploadedFile = await googleDriveRequest<DriveFile>(
    accessToken,
    `${GOOGLE_DRIVE_UPLOAD_BASE}?uploadType=multipart&fields=id,name,createdTime,modifiedTime`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  return {
    fileId: uploadedFile.id,
    fileName: uploadedFile.name,
    folderId: resolvedFolderId,
    timestamp: uploadedFile.modifiedTime || uploadedFile.createdTime,
  };
}

export async function performGoogleDriveLiveSync(
  state: FinanceState,
  options: {
    clientId: string;
    folderId?: string;
    fileId?: string;
    interactive?: boolean;
  }
): Promise<GoogleDriveBackupResult> {
  const accessToken = await requestGoogleAccessToken(options.clientId, options.interactive !== false);
  const resolvedFolderId = await ensureBackupFolder(accessToken, options.folderId);
  const payload = createGoogleDriveBackupPayload(state);
  const boundary = `finanzplanner-live-${Date.now()}`;

  const existingFile = options.fileId
    ? { id: options.fileId, name: GOOGLE_DRIVE_LIVE_FILE_NAME, createdTime: '' }
    : await findBackupFileByName(accessToken, resolvedFolderId, GOOGLE_DRIVE_LIVE_FILE_NAME);

  const body = createMultipartBody({
    name: GOOGLE_DRIVE_LIVE_FILE_NAME,
    parents: [resolvedFolderId],
    mimeType: 'application/json',
    appProperties: {
      app: 'finanzplanner',
      type: 'live-backup',
    },
  }, payload, boundary);

  const endpoint = existingFile
    ? `${GOOGLE_DRIVE_UPLOAD_BASE}/${existingFile.id}?uploadType=multipart&fields=id,name,createdTime,modifiedTime`
    : `${GOOGLE_DRIVE_UPLOAD_BASE}?uploadType=multipart&fields=id,name,createdTime,modifiedTime`;

  const uploadedFile = await googleDriveRequest<DriveFile>(
    accessToken,
    endpoint,
    {
      method: existingFile ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  return {
    fileId: uploadedFile.id,
    fileName: uploadedFile.name,
    folderId: resolvedFolderId,
    timestamp: uploadedFile.modifiedTime || uploadedFile.createdTime,
  };
}

export async function listGoogleDriveBackups(
  clientId: string,
  folderId?: string,
  interactive = true
): Promise<{ folderId: string; backups: GoogleDriveBackupFile[] }> {
  const accessToken = await requestGoogleAccessToken(clientId, interactive);
  const resolvedFolderId = await ensureBackupFolder(accessToken, folderId);
  const query = encodeURIComponent(`'${resolvedFolderId}' in parents and trashed = false`);
  const response = await googleDriveRequest<DriveListResponse>(
    accessToken,
    `${GOOGLE_DRIVE_API_BASE}/files?q=${query}&orderBy=createdTime desc&pageSize=15&fields=files(id,name,createdTime,size)`
  );

  return {
    folderId: resolvedFolderId,
    backups: (response.files || []).map((file) => ({
      id: file.id,
      name: file.name,
      createdTime: file.modifiedTime || file.createdTime,
      size: file.size ? Number(file.size) : undefined,
    })),
  };
}

export async function restoreGoogleDriveBackup(
  clientId: string,
  fileId: string,
  interactive = true
): Promise<Partial<FinanceState>> {
  const accessToken = await requestGoogleAccessToken(clientId, interactive);
  const response = await fetch(`${GOOGLE_DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Backup konnte nicht geladen werden.');
  }

  return response.json() as Promise<Partial<FinanceState>>;
}
