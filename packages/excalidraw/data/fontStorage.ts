import type { SceneFontAsset } from "@excalidraw/common";

const DB_NAME = "excalidraw-fonts";
const STORE_NAME = "custom-fonts";
const DB_VERSION = 1;

const getIDB = (): IDBFactory | undefined => {
  if (typeof window !== "undefined" && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== "undefined" && globalThis.indexedDB) {
    return globalThis.indexedDB;
  }
  return undefined;
};

const openDatabase = (): Promise<IDBDatabase | null> => {
  const idb = getIDB();
  if (!idb) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        } catch {
          resolve(null);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const saveCustomFontToStorage = async (
  asset: SceneFontAsset,
): Promise<void> => {
  try {
    const db = await openDatabase();
    if (!db) {
      return;
    }

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(asset);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}
};

export const loadCustomFontsFromStorage = async (): Promise<
  SceneFontAsset[]
> => {
  try {
    const db = await openDatabase();
    if (!db) {
      return [];
    }

    return await new Promise<SceneFontAsset[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () =>
          resolve((request.result as SceneFontAsset[]) || []);
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } catch {
    return [];
  }
};
