import type { FinanceState } from '../types';
import { createGoogleDriveBackupPayload } from './googleDriveBackup';

const LOCAL_FOLDER_DB_NAME = 'finanzplanner-local-folder-backup';
const LOCAL_FOLDER_STORE_NAME = 'handles';
const LOCAL_FOLDER_HANDLE_KEY = 'backup-directory';
const LOCAL_LIVE_FILE_NAME = 'finanzplanner-live-backup.json';

type DirectoryPermissionMode = 'read' | 'readwrite';

type PickerWindow = Window & typeof globalThis & {
  showDirectoryPicker?: (options?: { id?: string; mode?: DirectoryPermissionMode }) => Promise<FileSystemDirectoryHandle>;
};

type PermissionStateResult = 'granted' | 'denied' | 'prompt';

type PermissionDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (descriptor?: { mode?: DirectoryPermissionMode }) => Promise<PermissionStateResult>;
  requestPermission: (descriptor?: { mode?: DirectoryPermissionMode }) => Promise<PermissionStateResult>;
};

export interface LocalFolderBackupResult {
  directoryName: string;
  fileName: string;
  timestamp: string;
}

export interface LocalFolderBackupFile {
  name: string;
  createdTime: string;
  size?: number;
}

function getPickerWindow(): PickerWindow {
  return window as PickerWindow;
}

function createBackupFileName(date = new Date()): string {
  return `finanzplanner-backup-${date.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
}

function openLocalFolderDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_FOLDER_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LOCAL_FOLDER_STORE_NAME)) {
        database.createObjectStore(LOCAL_FOLDER_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Lokaler Backup-Speicher konnte nicht geöffnet werden.'));
  });
}

async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const database = await openLocalFolderDb();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(LOCAL_FOLDER_STORE_NAME, 'readonly');
    const store = transaction.objectStore(LOCAL_FOLDER_STORE_NAME);
    const request = store.get(LOCAL_FOLDER_HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) || null);
    request.onerror = () => reject(request.error || new Error('Lokaler Backup-Ordner konnte nicht geladen werden.'));
    transaction.oncomplete = () => database.close();
  });
}

async function storeDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const database = await openLocalFolderDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(LOCAL_FOLDER_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(LOCAL_FOLDER_STORE_NAME);
    const request = store.put(handle, LOCAL_FOLDER_HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Lokaler Backup-Ordner konnte nicht gespeichert werden.'));
    transaction.oncomplete = () => database.close();
  });
}

async function ensureDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  interactive: boolean,
  mode: DirectoryPermissionMode = 'readwrite'
): Promise<void> {
  const permissionHandle = handle as PermissionDirectoryHandle;
  const currentPermission = await permissionHandle.queryPermission({ mode });
  if (currentPermission === 'granted') {
    return;
  }

  if (!interactive) {
    throw new Error('Der lokale Backup-Ordner braucht erneut eine Freigabe. Bitte den Ordner noch einmal verbinden.');
  }

  const requestedPermission = await permissionHandle.requestPermission({ mode });
  if (requestedPermission !== 'granted') {
    throw new Error('Der lokale Backup-Ordner wurde nicht freigegeben.');
  }
}

async function getDirectoryHandle(options: {
  interactive: boolean;
  createIfMissing?: boolean;
}): Promise<FileSystemDirectoryHandle> {
  if (!isLocalFolderBackupSupported()) {
    throw new Error('Lokale Live-Backups werden in diesem Browser nicht unterstützt. Bitte Chrome, Edge oder einen kompatiblen Browser verwenden.');
  }

  let handle = await getStoredDirectoryHandle();
  if (!handle && options.createIfMissing && options.interactive) {
    handle = await pickLocalBackupDirectory();
  }

  if (!handle) {
    throw new Error('Bitte zuerst einen lokalen Backup-Ordner auswählen.');
  }

  await ensureDirectoryPermission(handle, options.interactive, 'readwrite');
  return handle;
}

async function writeBackupFile(
  handle: FileSystemDirectoryHandle,
  fileName: string,
  payload: string
): Promise<LocalFolderBackupResult> {
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(payload);
  await writable.close();

  const file = await fileHandle.getFile();
  return {
    directoryName: handle.name,
    fileName,
    timestamp: new Date(file.lastModified).toISOString(),
  };
}

export function isLocalFolderBackupSupported(): boolean {
  return typeof window !== 'undefined' && typeof getPickerWindow().showDirectoryPicker === 'function';
}

export async function pickLocalBackupDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = getPickerWindow().showDirectoryPicker;
  if (!picker) {
    throw new Error('Dieser Browser unterstuetzt keine lokale Ordnerauswahl fuer Live-Backups.');
  }

  const handle = await picker({
    id: 'finanzplanner-backups',
    mode: 'readwrite',
  });

  await ensureDirectoryPermission(handle, true, 'readwrite');
  await storeDirectoryHandle(handle);
  return handle;
}

export async function connectLocalBackupDirectory(): Promise<{ directoryName: string }> {
  const handle = await pickLocalBackupDirectory();
  return { directoryName: handle.name };
}

export async function performLocalFolderBackup(
  state: FinanceState,
  interactive = true
): Promise<LocalFolderBackupResult> {
  const handle = await getDirectoryHandle({ interactive, createIfMissing: interactive });
  return writeBackupFile(handle, createBackupFileName(), createGoogleDriveBackupPayload(state));
}

export async function performLocalFolderLiveSync(
  state: FinanceState,
  interactive = true
): Promise<LocalFolderBackupResult> {
  const handle = await getDirectoryHandle({ interactive, createIfMissing: interactive });
  return writeBackupFile(handle, LOCAL_LIVE_FILE_NAME, createGoogleDriveBackupPayload(state));
}

export async function listLocalFolderBackups(interactive = true): Promise<{
  directoryName: string;
  backups: LocalFolderBackupFile[];
}> {
  const handle = await getDirectoryHandle({ interactive, createIfMissing: false });
  const backups: LocalFolderBackupFile[] = [];

  for await (const entry of handle.values()) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) {
      continue;
    }

    const file = await entry.getFile();
    backups.push({
      name: entry.name,
      createdTime: new Date(file.lastModified).toISOString(),
      size: file.size,
    });
  }

  backups.sort((left, right) => new Date(right.createdTime).getTime() - new Date(left.createdTime).getTime());

  return {
    directoryName: handle.name,
    backups,
  };
}

export async function restoreLocalFolderBackup(
  fileName: string,
  interactive = true
): Promise<Partial<FinanceState>> {
  const handle = await getDirectoryHandle({ interactive, createIfMissing: false });
  const fileHandle = await handle.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  return JSON.parse(await file.text()) as Partial<FinanceState>;
}
