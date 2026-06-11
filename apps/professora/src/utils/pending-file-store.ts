const DB_NAME = 'approf-pending-files'
const STORE = 'files'
const DB_VERSION = 1

type PendingFileRecord = {
  name: string
  type: string
  lastModified: number
  buffer: ArrayBuffer
}

type PendingFilesRecord = PendingFileRecord[]

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir IndexedDB.'))
  })
}

function runTransaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = run(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(request.result as T)
    tx.onerror = () => reject(tx.error ?? new Error('Falha na transação IndexedDB.'))
    request.onerror = () => reject(request.error ?? new Error('Falha ao acessar arquivo pendente.'))
  }))
}

async function serializeFile(file: File): Promise<PendingFileRecord> {
  return {
    name: file.name,
    type: file.type || 'application/octet-stream',
    lastModified: file.lastModified,
    buffer: await file.arrayBuffer(),
  }
}

function deserializeFile(record: PendingFileRecord) {
  return new File([record.buffer], record.name, {
    type: record.type,
    lastModified: record.lastModified,
  })
}

export async function savePendingFile(key: string, file: File) {
  const record = await serializeFile(file)
  await runTransaction('readwrite', (store) => store.put(record, key))
}

export async function loadPendingFile(key: string): Promise<File | null> {
  try {
    const value = await runTransaction<PendingFileRecord | File | undefined>('readonly', (store) => store.get(key))
    if (value instanceof File) return value
    if (value && typeof value === 'object' && value.buffer instanceof ArrayBuffer) {
      return deserializeFile(value)
    }
    return null
  } catch {
    return null
  }
}

export async function clearPendingFile(key: string) {
  try {
    await runTransaction('readwrite', (store) => store.delete(key))
  } catch {
    // ignore
  }
}

export async function savePendingFiles(key: string, files: File[]) {
  const records = await Promise.all(files.map((file) => serializeFile(file)))
  await runTransaction('readwrite', (store) => store.put(records, key))
}

export async function loadPendingFiles(key: string): Promise<File[]> {
  try {
    const value = await runTransaction<PendingFilesRecord | File[] | undefined>('readonly', (store) => store.get(key))
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (item instanceof File) return item
        if (item && typeof item === 'object' && item.buffer instanceof ArrayBuffer) {
          return deserializeFile(item)
        }
        return null
      }).filter((item): item is File => item instanceof File)
    }
    return []
  } catch {
    return []
  }
}

export async function clearPendingFiles(key: string) {
  try {
    await runTransaction('readwrite', (store) => store.delete(key))
  } catch {
    // ignore
  }
}
