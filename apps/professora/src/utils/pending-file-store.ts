const DB_NAME = 'approf-pending-files'
const STORE = 'files'
const DB_VERSION = 1

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

export async function savePendingFile(key: string, file: File) {
  await runTransaction('readwrite', (store) => store.put(file, key))
}

export async function loadPendingFile(key: string): Promise<File | null> {
  try {
    const value = await runTransaction<File | undefined>('readonly', (store) => store.get(key))
    return value instanceof File ? value : null
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
  await runTransaction('readwrite', (store) => store.put(files, key))
}

export async function loadPendingFiles(key: string): Promise<File[]> {
  try {
    const value = await runTransaction<File[] | undefined>('readonly', (store) => store.get(key))
    return Array.isArray(value) ? value.filter((item): item is File => item instanceof File) : []
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
