import {
  CategoryDefinition,
  PaymentVerificationRequest,
  SubscriptionState,
} from '../types/business';

const DB_NAME = 'aqsa_bms_local_room_db';
const DB_VERSION = 2;
const STORE_CATEGORIES = 'categories';
const STORE_UNITS = 'item_units';
const STORE_SUBSCRIPTIONS = 'subscriptions';
const STORE_PAY_REQUESTS = 'payment_verifications';

function openLocalDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
          db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_UNITS)) {
          db.createObjectStore(STORE_UNITS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SUBSCRIPTIONS)) {
          db.createObjectStore(STORE_SUBSCRIPTIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PAY_REQUESTS)) {
          db.createObjectStore(STORE_PAY_REQUESTS, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveCategoriesToLocalDb(categories: CategoryDefinition[]): Promise<void> {
  const db = await openLocalDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
    const store = tx.objectStore(STORE_CATEGORIES);
    store.clear();
    for (const cat of categories) {
      store.put(cat);
    }
  } catch {
    // Fallback remains active in localStorage
  }
}

export async function loadCategoriesFromLocalDb(): Promise<CategoryDefinition[] | null> {
  const db = await openLocalDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CATEGORIES, 'readonly');
      const store = tx.objectStore(STORE_CATEGORIES);
      const req = store.getAll();
      req.onsuccess = () => {
        const res = req.result as CategoryDefinition[];
        resolve(Array.isArray(res) && res.length > 0 ? res : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveItemUnitsToLocalDb(units: string[]): Promise<void> {
  const db = await openLocalDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_UNITS, 'readwrite');
    tx.objectStore(STORE_UNITS).put({
      id: 'unit_list',
      units,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Fallback remains active in localStorage
  }
}

export async function loadItemUnitsFromLocalDb(): Promise<string[] | null> {
  const db = await openLocalDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_UNITS, 'readonly');
      const req = tx.objectStore(STORE_UNITS).get('unit_list');
      req.onsuccess = () => {
        const res = req.result as { units?: string[] } | undefined;
        resolve(Array.isArray(res?.units) && res.units.length > 0 ? res.units : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSubscriptionToLocalDb(subscription: SubscriptionState): Promise<void> {
  const db = await openLocalDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_SUBSCRIPTIONS, 'readwrite');
    tx.objectStore(STORE_SUBSCRIPTIONS).put({
      id: 'current_subscription',
      data: subscription,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Fallback remains active in localStorage
  }
}

export async function loadSubscriptionFromLocalDb(): Promise<SubscriptionState | null> {
  const db = await openLocalDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SUBSCRIPTIONS, 'readonly');
      const req = tx.objectStore(STORE_SUBSCRIPTIONS).get('current_subscription');
      req.onsuccess = () => {
        const res = req.result as { data?: SubscriptionState } | undefined;
        resolve(res?.data ?? null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function savePaymentRequestsToLocalDb(
  requests: PaymentVerificationRequest[]
): Promise<void> {
  const db = await openLocalDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_PAY_REQUESTS, 'readwrite');
    const store = tx.objectStore(STORE_PAY_REQUESTS);
    store.clear();
    for (const r of requests) {
      store.put(r);
    }
  } catch {
    // Fallback remains active in localStorage
  }
}

export async function loadPaymentRequestsFromLocalDb(): Promise<PaymentVerificationRequest[] | null> {
  const db = await openLocalDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PAY_REQUESTS, 'readonly');
      const req = tx.objectStore(STORE_PAY_REQUESTS).getAll();
      req.onsuccess = () => {
        const res = req.result as PaymentVerificationRequest[];
        resolve(Array.isArray(res) && res.length > 0 ? res : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Compresses an uploaded/camera image file into a crisp WebP/JPEG Data URL
 * suitable for both local storage and Firestore (< 200 KB).
 */
export function compressImageFileToDataUrl(
  file: File,
  maxDim = 800,
  quality = 0.74
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : '';
      if (!src) {
        reject(new Error('Empty image data'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(src);
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed.length < 235000 ? compressed : canvas.toDataURL('image/jpeg', 0.52));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
