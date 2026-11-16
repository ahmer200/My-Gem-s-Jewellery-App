import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  CompanyProfile,
  InventoryItem,
  ModuleId,
  PartyAccount,
  PaymentRecord,
  PermissionKey,
  PurchaseRecord,
  ReminderLog,
  ReminderSettings,
  ReturnRecord,
  SalesOrder,
  StaffAccount,
} from '../types/business';
import {
  INITIAL_INVENTORY,
  INITIAL_PARTIES,
  INITIAL_PAYMENTS,
  INITIAL_PROFILE,
  INITIAL_PURCHASES,
  INITIAL_REMINDER_SETTINGS,
  INITIAL_REMINDERS,
  INITIAL_RETURNS,
  INITIAL_SALES,
  INITIAL_STAFF,
} from '../utils/seedData';
import {
  auth,
  CloudKnownState,
  deleteCloudDocument,
  pullWorkspaceFromCloud,
  pushWorkspaceToCloud,
  signInWithGoogle,
  signOutFirebase,
  subscribeToWorkspace,
  testFirestoreConnection,
} from '../lib/firebase';

import { getRateForCurrency } from '../utils/currency';
import { DEFAULT_CURRENCY_RATES_PKR } from '../utils/worldCurrencies';

const STORAGE_KEY = 'aqsa_bms_na_gems_v1';
const THEME_KEY = 'aqsa_bms_theme_v1';
const AUTO_SYNC_KEY = 'aqsa_bms_auto_sync_v1';

interface StoredBusinessState {
  profile: CompanyProfile;
  inventory: InventoryItem[];
  purchases: PurchaseRecord[];
  sales: SalesOrder[];
  returns: ReturnRecord[];
  payments: PaymentRecord[];
  reminders: ReminderLog[];
  reminderSettings: ReminderSettings;
  staff: StaffAccount[];
  parties: PartyAccount[];
  activeStaffId: string;
}

function normalizeProfile(rawProfile?: Partial<CompanyProfile>): CompanyProfile {
  const mergedRates: Record<string, number> = {
    ...DEFAULT_CURRENCY_RATES_PKR,
    ...(rawProfile?.currencyRates || {}),
  };
  if (typeof rawProfile?.rmbToPkr === 'number' && !rawProfile?.currencyRates?.CNY) {
    mergedRates.CNY = rawProfile.rmbToPkr;
    mergedRates.RMB = rawProfile.rmbToPkr;
  }
  if (typeof rawProfile?.usdToPkr === 'number' && !rawProfile?.currencyRates?.USD) {
    mergedRates.USD = rawProfile.usdToPkr;
  }
  return {
    ...INITIAL_PROFILE,
    ...(rawProfile || {}),
    defaultCurrency: rawProfile?.defaultCurrency || INITIAL_PROFILE.defaultCurrency,
    currencyRates: mergedRates,
  };
}

function loadInitialState(): StoredBusinessState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredBusinessState>;
      return {
        profile: normalizeProfile(parsed.profile),
        inventory: Array.isArray(parsed.inventory)
          ? parsed.inventory.map((i) => ({
              ...i,
              subCategory: i.subCategory ?? '',
              stockPieces: i.stockPieces ?? i.stockQty ?? 0,
              itemUnit: i.itemUnit ?? 'Carats',
              oneTpWeight: i.oneTpWeight ?? i.weightCarats ?? 0,
              batchNumber: i.batchNumber ?? '',
              cent: i.cent ?? Math.round(((i.oneTpWeight ?? i.weightCarats) || 0) * 100),
              fridge: i.fridge ?? '',
              via: i.via ?? 'By Air',
              purchaseDate: i.purchaseDate ?? '',
              returnLossDamage: i.returnLossDamage ?? '0',
            }))
          : INITIAL_INVENTORY,
        purchases: Array.isArray(parsed.purchases) ? parsed.purchases : INITIAL_PURCHASES,
        sales: Array.isArray(parsed.sales)
          ? parsed.sales.map((s) => ({
              ...s,
              courierCharges: s.courierCharges ?? 0,
              dispatchStatus: s.dispatchStatus ?? 'Pending',
            }))
          : INITIAL_SALES,
        returns: Array.isArray(parsed.returns) ? parsed.returns : INITIAL_RETURNS,
        payments: Array.isArray(parsed.payments) ? parsed.payments : INITIAL_PAYMENTS,
        reminders: Array.isArray(parsed.reminders) ? parsed.reminders : INITIAL_REMINDERS,
        reminderSettings: {
          ...INITIAL_REMINDER_SETTINGS,
          ...(parsed.reminderSettings || {}),
        },
        staff: Array.isArray(parsed.staff) && parsed.staff.length > 0 ? parsed.staff : INITIAL_STAFF,
        parties: Array.isArray(parsed.parties) ? parsed.parties : INITIAL_PARTIES,
        activeStaffId: parsed.activeStaffId || INITIAL_STAFF[0].id,
      };
    }
  } catch (err) {
    console.error('Failed to read local storage state:', err);
  }

  return {
    profile: INITIAL_PROFILE,
    inventory: INITIAL_INVENTORY,
    purchases: INITIAL_PURCHASES,
    sales: INITIAL_SALES,
    returns: INITIAL_RETURNS,
    payments: INITIAL_PAYMENTS,
    reminders: INITIAL_REMINDERS,
    reminderSettings: INITIAL_REMINDER_SETTINGS,
    staff: INITIAL_STAFF,
    parties: INITIAL_PARTIES,
    activeStaffId: INITIAL_STAFF[0].id,
  };
}

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface BusinessContextValue extends StoredBusinessState {
  activeModule: ModuleId;
  setActiveModule: (module: ModuleId) => void;
  activeOperator: StaffAccount;
  hasPermission: (perm: PermissionKey) => boolean;
  switchOperator: (staffId: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  toasts: ToastMessage[];
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
  // Scanner quick cart handoff
  posQueuedSku: string | null;
  setPosQueuedSku: (sku: string | null) => void;
  // Sale invoice edit handoff
  queuedEditSaleId: string | null;
  setQueuedEditSaleId: (id: string | null) => void;
  openSaleForEdit: (id: string) => void;
  // Mutations
  updateProfile: (next: Partial<CompanyProfile>) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => InventoryItem;
  updateInventoryItem: (id: string, patch: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;
  addPurchase: (purchase: Omit<PurchaseRecord, 'id' | 'createdAt'>) => PurchaseRecord;
  payPurchaseBalance: (purchaseId: string, amountPkr: number) => void;
  deletePurchase: (id: string) => void;
  addSale: (sale: Omit<SalesOrder, 'id' | 'createdAt'>) => SalesOrder;
  updateSale: (saleId: string, updated: Omit<SalesOrder, 'id' | 'createdAt'>) => SalesOrder | null;
  dispatchSale: (saleId: string, expectedArrivalDate: string) => void;
  recordSalePayment: (saleId: string, amountPkr: number, method: PaymentRecord['method']) => void;
  deleteSale: (id: string) => void;
  addReturn: (ret: Omit<ReturnRecord, 'id' | 'createdAt'>) => ReturnRecord;
  deleteReturn: (id: string) => void;
  addPayment: (payment: Omit<PaymentRecord, 'id' | 'createdAt'>) => PaymentRecord;
  deletePayment: (id: string) => void;
  addReminderLog: (log: Omit<ReminderLog, 'id'>) => void;
  deleteReminderLog: (id: string) => void;
  updateReminderSettings: (settings: Partial<ReminderSettings>) => void;
  addStaffAccount: (account: Omit<StaffAccount, 'id' | 'createdAt'>) => void;
  updateStaffAccount: (id: string, patch: Partial<StaffAccount>) => void;
  deleteStaffAccount: (id: string) => void;
  addParty: (party: Omit<PartyAccount, 'id' | 'createdAt' | 'updatedAt'>) => PartyAccount;
  updateParty: (id: string, patch: Partial<Omit<PartyAccount, 'id' | 'createdAt'>>) => void;
  deleteParty: (id: string) => void;
  // Local Backup & Reset
  exportBackupJson: () => void;
  importBackupJson: (jsonText: string) => void;
  resetDemoData: () => void;
  // Cloud Sync (Firebase)
  firebaseUser: User | null;
  authReady: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  liveSyncActive: boolean;
  pendingOfflineSync: boolean;
  cloudSignIn: () => Promise<void>;
  cloudSignOut: () => Promise<void>;
  syncNowToCloud: () => Promise<void>;
  pullFromCloudBackup: () => Promise<void>;
}

const BusinessContext = createContext<BusinessContextValue | null>(null);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<StoredBusinessState>(loadInitialState);
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [posQueuedSku, setPosQueuedSku] = useState<string | null>(null);
  const [queuedEditSaleId, setQueuedEditSaleId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Firebase Auth & Real-Time Auto-Sync state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem(AUTO_SYNC_KEY);
    return saved !== 'false';
  });
  const [liveSyncActive, setLiveSyncActive] = useState(false);
  const [pendingOfflineSync, setPendingOfflineSync] = useState(false);
  const [localMutationSeq, setLocalMutationSeq] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;

  const knownCloudStateRef = useRef<CloudKnownState>({
    workspaceExists: false,
    profileExists: false,
    inventoryIds: new Set(),
    purchaseIds: new Set(),
    saleDispatchMap: new Map(),
    returnIds: new Set(),
    paymentIds: new Set(),
    reminderIds: new Set(),
    staffIds: new Set(),
    partyIds: new Set(),
  });
  const cloudSettledRef = useRef(false);

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    localStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
  }, []);

  const markLocalMutation = useCallback(() => {
    setLocalMutationSeq((n) => n + 1);
  }, []);

  const notify = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('LocalStorage save failed:', err);
    }
  }, [state]);

  // Apply dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Firebase boot & auth listener
  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore subscription when signed in
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setLiveSyncActive(false);
      cloudSettledRef.current = false;
      return;
    }

    const emptyKnown: CloudKnownState = {
      workspaceExists: false,
      profileExists: false,
      inventoryIds: new Set(),
      purchaseIds: new Set(),
      saleDispatchMap: new Map(),
      returnIds: new Set(),
      paymentIds: new Set(),
      reminderIds: new Set(),
      staffIds: new Set(),
      partyIds: new Set(),
    };
    knownCloudStateRef.current = emptyKnown;
    cloudSettledRef.current = false;

    const unsub = subscribeToWorkspace(firebaseUser.uid, {
      knownState: emptyKnown,
      onProfile: (profile) => {
        setState((prev) => ({ ...prev, profile: { ...prev.profile, ...profile } }));
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onInventory: (inventory) => {
        setState((prev) => ({ ...prev, inventory }));
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onPurchases: (purchases) => {
        setState((prev) => ({ ...prev, purchases }));
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onSales: (sales) => {
        setState((prev) => ({ ...prev, sales }));
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onReturns: (returns) => {
        setState((prev) => ({ ...prev, returns }));
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onPayments: (payments) => {
        setState((prev) => ({ ...prev, payments }));
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onReminders: (reminders) => {
        setState((prev) => ({ ...prev, reminders }));
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onStaff: (staff) => {
        setState((prev) => ({
          ...prev,
          staff,
          activeStaffId: staff.some((s) => s.id === prev.activeStaffId)
            ? prev.activeStaffId
            : staff[0]?.id || prev.activeStaffId,
        }));
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onParties: (parties) => {
        setState((prev) => ({ ...prev, parties }));
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onInitialSyncCheck: (isWorkspaceEmpty) => {
        cloudSettledRef.current = true;
        setLiveSyncActive(true);
        if (isWorkspaceEmpty && autoSyncEnabled) {
          const cur = stateRef.current;
          setIsSyncing(true);
          pushWorkspaceToCloud(
            firebaseUser.uid,
            {
              profile: cur.profile,
              inventory: cur.inventory,
              purchases: cur.purchases,
              sales: cur.sales,
              returns: cur.returns,
              payments: cur.payments,
              reminders: cur.reminders,
              staff: cur.staff,
              parties: cur.parties,
            },
            knownCloudStateRef.current
          )
            .then(() => {
              setLastSyncedAt(new Date().toLocaleTimeString());
              setPendingOfflineSync(false);
            })
            .catch(() => {
              setPendingOfflineSync(true);
            })
            .finally(() => setIsSyncing(false));
        }
      },
      onError: () => {
        setLiveSyncActive(false);
      },
    });

    return () => {
      unsub();
      setLiveSyncActive(false);
      cloudSettledRef.current = false;
    };
  }, [authReady, firebaseUser, autoSyncEnabled]);

  // Automatic debounced Cloud Push whenever local mutations occur
  useEffect(() => {
    if (localMutationSeq === 0 || !firebaseUser || !autoSyncEnabled) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setPendingOfflineSync(true);
      return;
    }

    const timer = setTimeout(() => {
      if (!cloudSettledRef.current) {
        setPendingOfflineSync(true);
        return;
      }
      const cur = stateRef.current;
      setIsSyncing(true);
      pushWorkspaceToCloud(
        firebaseUser.uid,
        {
          profile: cur.profile,
          inventory: cur.inventory,
          purchases: cur.purchases,
          sales: cur.sales,
          returns: cur.returns,
          payments: cur.payments,
          reminders: cur.reminders,
          staff: cur.staff,
          parties: cur.parties,
        },
        knownCloudStateRef.current
      )
        .then(() => {
          setLastSyncedAt(new Date().toLocaleTimeString());
          setPendingOfflineSync(false);
        })
        .catch(() => {
          setPendingOfflineSync(true);
        })
        .finally(() => setIsSyncing(false));
    }, 650);

    return () => clearTimeout(timer);
  }, [localMutationSeq, firebaseUser, autoSyncEnabled]);

  // Auto-flush queued offline changes when device returns online
  useEffect(() => {
    const handleOnline = () => {
      if (!firebaseUser || !autoSyncEnabled || !pendingOfflineSync) return;
      const cur = stateRef.current;
      setIsSyncing(true);
      pushWorkspaceToCloud(firebaseUser.uid, {
        profile: cur.profile,
        inventory: cur.inventory,
        purchases: cur.purchases,
        sales: cur.sales,
        returns: cur.returns,
        payments: cur.payments,
        reminders: cur.reminders,
        staff: cur.staff,
        parties: cur.parties,
      })
        .then(() => {
          setLastSyncedAt(new Date().toLocaleTimeString());
          setPendingOfflineSync(false);
          notify('Offline edits automatically synced to all devices.');
        })
        .catch(() => {
          setPendingOfflineSync(true);
        })
        .finally(() => setIsSyncing(false));
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [firebaseUser, autoSyncEnabled, pendingOfflineSync, notify]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const activeOperator =
    state.staff.find((s) => s.id === state.activeStaffId) || state.staff[0] || INITIAL_STAFF[0];

  const hasPermission = useCallback(
    (perm: PermissionKey) => {
      if (activeOperator.role === 'admin') return true;
      return activeOperator.permissions.includes(perm);
    },
    [activeOperator]
  );

  const switchOperator = useCallback(
    (staffId: string) => {
      const target = state.staff.find((s) => s.id === staffId);
      if (!target || !target.active) {
        notify('Account is inactive or not found.', 'error');
        return;
      }
      setState((prev) => ({ ...prev, activeStaffId: staffId }));
      notify(`Switched active operator to ${target.name} (${target.role.toUpperCase()})`, 'info');
    },
    [state.staff, notify]
  );

  const updateProfile = useCallback(
    (next: Partial<CompanyProfile>) => {
      setState((prev) => ({
        ...prev,
        profile: { ...prev.profile, ...next },
      }));
      markLocalMutation();
      notify('Business profile & exchange rates saved.');
    },
    [markLocalMutation, notify]
  );

  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): InventoryItem => {
      const now = new Date().toISOString();
      const created: InventoryItem = {
        ...item,
        id: `inv-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      setState((prev) => ({
        ...prev,
        inventory: [created, ...prev.inventory],
      }));
      markLocalMutation();
      notify(`Added ${created.name} (${created.sku}) to inventory.`);
      return created;
    },
    [markLocalMutation, notify]
  );

  const updateInventoryItem = useCallback(
    (id: string, patch: Partial<InventoryItem>) => {
      setState((prev) => ({
        ...prev,
        inventory: prev.inventory.map((item) =>
          item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item
        ),
      }));
      markLocalMutation();
      notify('Inventory item updated.');
    },
    [markLocalMutation, notify]
  );

  const deleteInventoryItem = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        inventory: prev.inventory.filter((item) => item.id !== id),
      }));
      if (firebaseUser) {
        void deleteCloudDocument(firebaseUser.uid, 'inventory', id).catch(() => {});
      }
      notify('Inventory item deleted.', 'info');
    },
    [firebaseUser, notify]
  );

  const addPurchase = useCallback(
    (purchase: Omit<PurchaseRecord, 'id' | 'createdAt'>): PurchaseRecord => {
      const created: PurchaseRecord = {
        ...purchase,
        id: `pur-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => {
        // Auto-increment stock quantities for linked inventory items
        const nextInventory = prev.inventory.map((inv) => {
          const line = created.items.find(
            (li) => li.inventoryId === inv.id || li.sku.toLowerCase() === inv.sku.toLowerCase()
          );
          if (!line) return inv;
          return {
            ...inv,
            stockQty: inv.stockQty + line.quantity,
            costCurrency: created.currency,
            unitCost: line.unitCostOrig > 0 ? line.unitCostOrig : inv.unitCost,
            updatedAt: new Date().toISOString(),
          };
        });

        // Log outgoing payment if paid > 0
        const nextPayments = [...prev.payments];
        if (created.paidPkr > 0) {
          const rate = created.exchangeRateApplied > 0 ? created.exchangeRateApplied : 1;
          const origPaid =
            created.currency === 'PKR' ? created.paidPkr : Number((created.paidPkr / rate).toFixed(2));
          nextPayments.unshift({
            id: `pay-${Date.now()}`,
            type: 'Outgoing',
            category: 'Supplier Purchase',
            partyName: created.supplierName,
            referenceNo: created.referenceNo,
            currency: created.currency,
            exchangeRateApplied: rate,
            amountOrig: origPaid,
            amountPkr: created.paidPkr,
            method: 'Bank Transfer',
            paymentDate: created.purchaseDate,
            notes: `Auto-logged from Purchase ${created.referenceNo}`,
            createdAt: new Date().toISOString(),
          });
        }

        return {
          ...prev,
          purchases: [created, ...prev.purchases],
          inventory: nextInventory,
          payments: nextPayments,
        };
      });
      markLocalMutation();
      notify(`Purchase ${created.referenceNo} saved and stock updated.`);
      return created;
    },
    [markLocalMutation, notify]
  );

  const payPurchaseBalance = useCallback(
    (purchaseId: string, amountPkr: number) => {
      if (amountPkr <= 0) return;
      setState((prev) => {
        const target = prev.purchases.find((p) => p.id === purchaseId);
        if (!target) return prev;
        const newPaid = Math.min(target.totalPkr, target.paidPkr + amountPkr);
        const newStatus: PurchaseRecord['status'] =
          newPaid >= target.totalPkr - 1 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Payable';

        const rate = target.exchangeRateApplied > 0 ? target.exchangeRateApplied : 1;
        const origAmt = target.currency === 'PKR' ? amountPkr : Number((amountPkr / rate).toFixed(2));

        const payRec: PaymentRecord = {
          id: `pay-${Date.now()}`,
          type: 'Outgoing',
          category: 'Supplier Payable',
          partyName: target.supplierName,
          referenceNo: target.referenceNo,
          currency: target.currency,
          exchangeRateApplied: rate,
          amountOrig: origAmt,
          amountPkr,
          method: 'Bank Transfer',
          paymentDate: new Date().toISOString().slice(0, 10),
          notes: `Supplier settlement for ${target.referenceNo}`,
          createdAt: new Date().toISOString(),
        };

        return {
          ...prev,
          purchases: prev.purchases.map((p) =>
            p.id === purchaseId ? { ...p, paidPkr: newPaid, status: newStatus } : p
          ),
          payments: [payRec, ...prev.payments],
        };
      });
      markLocalMutation();
      notify('Supplier payment recorded.');
    },
    [markLocalMutation, notify]
  );

  const deletePurchase = useCallback(
    (id: string) => {
      setState((prev) => {
        const target = prev.purchases.find((p) => p.id === id);
        if (!target) return prev;
        const nextInventory = prev.inventory.map((inv) => {
          const addedQty = target.items
            .filter(
              (li) =>
                li.inventoryId === inv.id ||
                li.sku.toLowerCase() === inv.sku.toLowerCase()
            )
            .reduce((sum, li) => sum + li.quantity, 0);
          if (addedQty <= 0) return inv;
          return {
            ...inv,
            stockQty: Math.max(0, inv.stockQty - addedQty),
            updatedAt: new Date().toISOString(),
          };
        });
        return {
          ...prev,
          purchases: prev.purchases.filter((p) => p.id !== id),
          inventory: nextInventory,
        };
      });
      if (firebaseUser) {
        void deleteCloudDocument(firebaseUser.uid, 'purchases', id).catch(() => {});
      }
      markLocalMutation();
      notify('Purchase record deleted & linked stock adjusted.', 'info');
    },
    [firebaseUser, markLocalMutation, notify]
  );

  const addSale = useCallback(
    (sale: Omit<SalesOrder, 'id' | 'createdAt'>): SalesOrder => {
      const created: SalesOrder = {
        ...sale,
        courierCharges: sale.courierCharges ?? 0,
        dispatchStatus: sale.dispatchStatus || 'Pending',
        id: `sale-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => {
        // Auto-deduct stock
        const nextInventory = prev.inventory.map((inv) => {
          const soldQty = created.items
            .filter((li) => li.inventoryId === inv.id)
            .reduce((sum, li) => sum + li.quantity, 0);
          if (soldQty <= 0) return inv;
          return {
            ...inv,
            stockQty: Math.max(0, inv.stockQty - soldQty),
            updatedAt: new Date().toISOString(),
          };
        });

        const nextPayments = [...prev.payments];
        if (created.paidAmountPkr > 0) {
          const activeRate =
            created.finalCurrency === 'PKR'
              ? 1
              : created.exchangeRateApplied > 0
                ? created.exchangeRateApplied
                : getRateForCurrency(created.finalCurrency, prev.profile);
          const origAmt =
            created.finalCurrency === 'PKR'
              ? created.paidAmountPkr
              : activeRate > 0
                ? Number((created.paidAmountPkr / activeRate).toFixed(2))
                : created.finalTotal;

          nextPayments.unshift({
            id: `pay-${Date.now()}`,
            type: 'Incoming',
            category: 'Customer Invoice Payment',
            partyName: created.customerName,
            referenceNo: created.invoiceNo,
            currency: created.finalCurrency,
            exchangeRateApplied: activeRate,
            amountOrig: origAmt,
            amountPkr: created.paidAmountPkr,
            method: 'Cash',
            paymentDate: created.orderDate,
            notes: `Payment on Invoice ${created.invoiceNo}`,
            createdAt: new Date().toISOString(),
          });
        }

        return {
          ...prev,
          sales: [created, ...prev.sales],
          inventory: nextInventory,
          payments: nextPayments,
        };
      });
      markLocalMutation();
      notify(`Invoice ${created.invoiceNo} created & stock updated.`);
      return created;
    },
    [markLocalMutation, notify]
  );

  const openSaleForEdit = useCallback(
    (saleId: string) => {
      const target = state.sales.find((s) => s.id === saleId);
      if (!target) {
        notify('Invoice not found.', 'error');
        return;
      }
      if (target.dispatchStatus === 'Dispatched') {
        notify(`Invoice ${target.invoiceNo} is already dispatched and locked from editing.`, 'error');
        return;
      }
      setQueuedEditSaleId(saleId);
      setActiveModule('sales');
    },
    [state.sales, notify]
  );

  const updateSale = useCallback(
    (saleId: string, updated: Omit<SalesOrder, 'id' | 'createdAt'>): SalesOrder | null => {
      const existing = state.sales.find((s) => s.id === saleId);
      if (!existing) {
        notify('Invoice not found for update.', 'error');
        return null;
      }
      if (existing.dispatchStatus === 'Dispatched') {
        notify(`Invoice ${existing.invoiceNo} is dispatched and cannot be edited.`, 'error');
        return null;
      }

      const savedOrder: SalesOrder = {
        ...existing,
        ...updated,
        id: existing.id,
        createdAt: existing.createdAt,
        courierCharges: updated.courierCharges ?? 0,
        dispatchStatus: existing.dispatchStatus || 'Pending',
      };

      setState((prev) => {
        const currentExisting = prev.sales.find((s) => s.id === saleId);
        if (!currentExisting || currentExisting.dispatchStatus === 'Dispatched') return prev;

        // Reconcile inventory: restore old sold quantities and deduct updated quantities
        const nextInventory = prev.inventory.map((inv) => {
          const oldQty = currentExisting.items
            .filter(
              (li) => li.inventoryId === inv.id || li.sku.toLowerCase() === inv.sku.toLowerCase()
            )
            .reduce((sum, li) => sum + li.quantity, 0);
          const newQty = savedOrder.items
            .filter(
              (li) => li.inventoryId === inv.id || li.sku.toLowerCase() === inv.sku.toLowerCase()
            )
            .reduce((sum, li) => sum + li.quantity, 0);
          if (oldQty === 0 && newQty === 0) return inv;
          return {
            ...inv,
            stockQty: Math.max(0, inv.stockQty + oldQty - newQty),
            updatedAt: new Date().toISOString(),
          };
        });

        return {
          ...prev,
          sales: prev.sales.map((s) => (s.id === saleId ? savedOrder : s)),
          inventory: nextInventory,
        };
      });

      markLocalMutation();
      notify(`Invoice ${savedOrder.invoiceNo} updated & stock reconciled.`);
      return savedOrder;
    },
    [state.sales, markLocalMutation, notify]
  );

  const dispatchSale = useCallback(
    (saleId: string, expectedArrivalDate: string) => {
      const target = state.sales.find((s) => s.id === saleId);
      if (!target) {
        notify('Invoice not found.', 'error');
        return;
      }
      if (target.dispatchStatus === 'Dispatched') {
        notify(`Invoice ${target.invoiceNo} is already dispatched.`, 'info');
        return;
      }
      const dispatchedAt = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        sales: prev.sales.map((s) =>
          s.id === saleId
            ? {
                ...s,
                dispatchStatus: 'Dispatched',
                expectedArrivalDate,
                dispatchedAt,
              }
            : s
        ),
      }));
      markLocalMutation();
      notify(
        `Invoice ${target.invoiceNo} dispatched (Arriving ${expectedArrivalDate}) & locked from edits.`
      );
    },
    [state.sales, markLocalMutation, notify]
  );

  const recordSalePayment = useCallback(
    (saleId: string, amountPkr: number, method: PaymentRecord['method']) => {
      if (amountPkr <= 0) return;
      setState((prev) => {
        const sale = prev.sales.find((s) => s.id === saleId);
        if (!sale) return prev;
        const newPaid = Math.min(sale.finalTotalPkrEquivalent, sale.paidAmountPkr + amountPkr);
        const newStatus: SalesOrder['paymentStatus'] =
          newPaid >= sale.finalTotalPkrEquivalent - 1 ? 'Paid' : newPaid > 0 ? 'Partial' : 'Pending';

        const paymentRec: PaymentRecord = {
          id: `pay-${Date.now()}`,
          type: 'Incoming',
          category: 'Customer Due Collection',
          partyName: sale.customerName,
          referenceNo: sale.invoiceNo,
          currency: 'PKR',
          exchangeRateApplied: 1,
          amountOrig: amountPkr,
          amountPkr,
          method,
          paymentDate: new Date().toISOString().slice(0, 10),
          notes: `Collection against ${sale.invoiceNo}`,
          createdAt: new Date().toISOString(),
        };

        return {
          ...prev,
          sales: prev.sales.map((s) =>
            s.id === saleId ? { ...s, paidAmountPkr: newPaid, paymentStatus: newStatus } : s
          ),
          payments: [paymentRec, ...prev.payments],
        };
      });
      markLocalMutation();
      notify('Customer payment recorded.');
    },
    [markLocalMutation, notify]
  );

  const deleteSale = useCallback(
    (id: string) => {
      setState((prev) => {
        const target = prev.sales.find((s) => s.id === id);
        if (!target) return prev;
        const nextInventory = prev.inventory.map((inv) => {
          const soldQty = target.items
            .filter(
              (li) =>
                li.inventoryId === inv.id ||
                li.sku.toLowerCase() === inv.sku.toLowerCase()
            )
            .reduce((sum, li) => sum + li.quantity, 0);
          if (soldQty <= 0) return inv;
          return {
            ...inv,
            stockQty: inv.stockQty + soldQty,
            updatedAt: new Date().toISOString(),
          };
        });
        return {
          ...prev,
          sales: prev.sales.filter((s) => s.id !== id),
          inventory: nextInventory,
        };
      });
      if (firebaseUser) {
        void deleteCloudDocument(firebaseUser.uid, 'sales', id).catch(() => {});
      }
      markLocalMutation();
      notify('Sales invoice deleted & sold stock restored.', 'info');
    },
    [firebaseUser, markLocalMutation, notify]
  );

  const addReturn = useCallback(
    (ret: Omit<ReturnRecord, 'id' | 'createdAt'>): ReturnRecord => {
      const created: ReturnRecord = {
        ...ret,
        id: `ret-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => {
        const nextInventory = created.restocked
          ? prev.inventory.map((inv) => {
              let addQty = 0;
              if (created.items && created.items.length > 0) {
                addQty = created.items
                  .filter(
                    (ri) =>
                      ri.inventoryId === inv.id ||
                      ri.sku.toLowerCase() === inv.sku.toLowerCase()
                  )
                  .reduce((sum, ri) => sum + ri.quantity, 0);
              } else if (
                inv.id === created.inventoryId ||
                inv.sku.toLowerCase() === created.sku.toLowerCase()
              ) {
                addQty = created.quantity;
              }
              if (addQty <= 0) return inv;
              return {
                ...inv,
                stockQty: inv.stockQty + addQty,
                updatedAt: new Date().toISOString(),
              };
            })
          : prev.inventory;

        const refundPayment: PaymentRecord = {
          id: `pay-${Date.now()}`,
          type: 'Outgoing',
          category: 'Sales Return Refund',
          partyName: created.customerName,
          referenceNo: created.returnNo,
          currency: created.refundCurrency,
          exchangeRateApplied: created.exchangeRateApplied,
          amountOrig: created.refundAmountOrig,
          amountPkr: created.refundAmountPkr,
          method: 'Cash',
          paymentDate: created.returnDate,
          notes: `Refund for ${created.invoiceNo} (${created.reason})`,
          createdAt: new Date().toISOString(),
        };

        return {
          ...prev,
          returns: [created, ...prev.returns],
          inventory: nextInventory,
          payments: [refundPayment, ...prev.payments],
        };
      });
      markLocalMutation();
      notify(`Return ${created.returnNo} processed.`);
      return created;
    },
    [markLocalMutation, notify]
  );

  const deleteReturn = useCallback(
    (id: string) => {
      setState((prev) => {
        const target = prev.returns.find((r) => r.id === id);
        if (!target) return prev;
        const nextInventory = target.restocked
          ? prev.inventory.map((inv) => {
              let removeQty = 0;
              if (target.items && target.items.length > 0) {
                removeQty = target.items
                  .filter(
                    (ri) =>
                      ri.inventoryId === inv.id ||
                      ri.sku.toLowerCase() === inv.sku.toLowerCase()
                  )
                  .reduce((sum, ri) => sum + ri.quantity, 0);
              } else if (
                inv.id === target.inventoryId ||
                inv.sku.toLowerCase() === target.sku.toLowerCase()
              ) {
                removeQty = target.quantity;
              }
              if (removeQty <= 0) return inv;
              return {
                ...inv,
                stockQty: Math.max(0, inv.stockQty - removeQty),
                updatedAt: new Date().toISOString(),
              };
            })
          : prev.inventory;
        return {
          ...prev,
          returns: prev.returns.filter((r) => r.id !== id),
          inventory: nextInventory,
        };
      });
      if (firebaseUser) {
        void deleteCloudDocument(firebaseUser.uid, 'returns', id).catch(() => {});
      }
      markLocalMutation();
      notify('Return record deleted.', 'info');
    },
    [firebaseUser, markLocalMutation, notify]
  );

  const addPayment = useCallback(
    (payment: Omit<PaymentRecord, 'id' | 'createdAt'>): PaymentRecord => {
      const created: PaymentRecord = {
        ...payment,
        id: `pay-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        payments: [created, ...prev.payments],
      }));
      markLocalMutation();
      notify(`${created.type} payment recorded.`);
      return created;
    },
    [markLocalMutation, notify]
  );

  const deletePayment = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        payments: prev.payments.filter((p) => p.id !== id),
      }));
      if (firebaseUser) {
        void deleteCloudDocument(firebaseUser.uid, 'payments', id).catch(() => {});
      }
      notify('Payment record deleted.', 'info');
    },
    [firebaseUser, notify]
  );

  const addReminderLog = useCallback(
    (log: Omit<ReminderLog, 'id'>) => {
      const created: ReminderLog = { ...log, id: `rem-${Date.now()}` };
      setState((prev) => ({
        ...prev,
        reminders: [created, ...prev.reminders],
      }));
      markLocalMutation();
    },
    [markLocalMutation]
  );

  const deleteReminderLog = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        reminders: prev.reminders.filter((r) => r.id !== id),
      }));
      if (firebaseUser) {
        void deleteCloudDocument(firebaseUser.uid, 'reminders', id).catch(() => {});
      }
      notify('Reminder log deleted.', 'info');
    },
    [firebaseUser, notify]
  );

  const updateReminderSettings = useCallback(
    (settings: Partial<ReminderSettings>) => {
      setState((prev) => ({
        ...prev,
        reminderSettings: { ...prev.reminderSettings, ...settings },
      }));
      notify('Reminder settings saved.');
    },
    [notify]
  );

  const addStaffAccount = useCallback(
    (account: Omit<StaffAccount, 'id' | 'createdAt'>) => {
      const created: StaffAccount = {
        ...account,
        id: `usr-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        staff: [...prev.staff, created],
      }));
      markLocalMutation();
      notify(`User account created for ${created.name}.`);
    },
    [markLocalMutation, notify]
  );

  const updateStaffAccount = useCallback(
    (id: string, patch: Partial<StaffAccount>) => {
      setState((prev) => ({
        ...prev,
        staff: prev.staff.map((u) => (u.id === id ? { ...u, ...patch } : u)),
      }));
      markLocalMutation();
      notify('User permissions updated.');
    },
    [markLocalMutation, notify]
  );

  const deleteStaffAccount = useCallback(
    (id: string) => {
      let deleted = false;
      setState((prev) => {
        if (prev.staff.length <= 1) return prev;
        deleted = true;
        const filtered = prev.staff.filter((u) => u.id !== id);
        return {
          ...prev,
          staff: filtered,
          activeStaffId:
            prev.activeStaffId === id ? filtered[0].id : prev.activeStaffId,
        };
      });
      if (deleted && firebaseUser) {
        void deleteCloudDocument(firebaseUser.uid, 'staff', id).catch(() => {});
      }
      notify('Staff account deleted.', 'info');
    },
    [firebaseUser, notify]
  );

  const addParty = useCallback(
    (party: Omit<PartyAccount, 'id' | 'createdAt' | 'updatedAt'>): PartyAccount => {
      const now = new Date().toISOString();
      const created: PartyAccount = {
        ...party,
        id: `pty-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      setState((prev) => ({
        ...prev,
        parties: [created, ...prev.parties],
      }));
      markLocalMutation();
      notify(`${created.partyType} profile "${created.name}" saved.`);
      return created;
    },
    [markLocalMutation, notify]
  );

  const updateParty = useCallback(
    (id: string, patch: Partial<Omit<PartyAccount, 'id' | 'createdAt'>>) => {
      setState((prev) => ({
        ...prev,
        parties: prev.parties.map((p) =>
          p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
        ),
      }));
      markLocalMutation();
      notify('Customer / vendor profile updated.');
    },
    [markLocalMutation, notify]
  );

  const deleteParty = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        parties: prev.parties.filter((p) => p.id !== id),
      }));
      if (firebaseUser) {
        void deleteCloudDocument(firebaseUser.uid, 'parties', id).catch(() => {});
      }
      notify('Customer / vendor profile deleted.', 'info');
    },
    [firebaseUser, notify]
  );

  const exportBackupJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Aqsa_BMS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Full local backup JSON downloaded.');
  }, [state, notify]);

  const importBackupJson = useCallback(
    (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText) as Partial<StoredBusinessState>;
        if (!parsed.profile || !Array.isArray(parsed.inventory)) {
          throw new Error('Invalid Aqsa BMS backup structure.');
        }
        setState((prev) => ({
          ...prev,
          ...parsed,
          profile: normalizeProfile(parsed.profile),
        }));
        markLocalMutation();
        notify('Backup restored successfully.');
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Failed to parse backup JSON.', 'error');
      }
    },
    [markLocalMutation, notify]
  );

  const resetDemoData = useCallback(() => {
    setState({
      profile: INITIAL_PROFILE,
      inventory: INITIAL_INVENTORY,
      purchases: INITIAL_PURCHASES,
      sales: INITIAL_SALES,
      returns: INITIAL_RETURNS,
      payments: INITIAL_PAYMENTS,
      reminders: INITIAL_REMINDERS,
      reminderSettings: INITIAL_REMINDER_SETTINGS,
      staff: INITIAL_STAFF,
      parties: INITIAL_PARTIES,
      activeStaffId: INITIAL_STAFF[0].id,
    });
    markLocalMutation();
    notify('Sample N.A GEM\'S catalog restored.', 'info');
  }, [markLocalMutation, notify]);

  const cloudSignIn = useCallback(async () => {
    try {
      const user = await signInWithGoogle();
      notify(`Signed in to Cloud Sync as ${user.email}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Google Sign-In failed.', 'error');
    }
  }, [notify]);

  const cloudSignOut = useCallback(async () => {
    await signOutFirebase();
    notify('Signed out from Firebase Cloud Sync.', 'info');
  }, [notify]);

  const syncNowToCloud = useCallback(async () => {
    if (!firebaseUser) {
      notify('Sign in with Google first to enable Cloud Sync.', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      const count = await pushWorkspaceToCloud(
        firebaseUser.uid,
        {
          profile: state.profile,
          inventory: state.inventory,
          purchases: state.purchases,
          sales: state.sales,
          returns: state.returns,
          payments: state.payments,
          reminders: state.reminders,
          staff: state.staff,
          parties: state.parties,
        },
        knownCloudStateRef.current
      );
      setLastSyncedAt(new Date().toLocaleTimeString());
      setPendingOfflineSync(false);
      notify(`Cloud Sync complete (${count} records synchronized).`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Cloud sync failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [firebaseUser, state, notify]);

  const pullFromCloudBackup = useCallback(async () => {
    if (!firebaseUser) {
      notify('Sign in with Google first.', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      const data = await pullWorkspaceFromCloud(firebaseUser.uid);
      if (!data) {
        notify('No cloud backup found for this account yet.', 'info');
      } else {
        setState((prev) => ({
          ...prev,
          profile: data.profile ? { ...prev.profile, ...data.profile } : prev.profile,
          inventory: data.inventory && data.inventory.length > 0 ? data.inventory : prev.inventory,
          purchases: data.purchases && data.purchases.length > 0 ? data.purchases : prev.purchases,
          sales: data.sales && data.sales.length > 0 ? data.sales : prev.sales,
          returns: data.returns && data.returns.length > 0 ? data.returns : prev.returns,
          payments: data.payments && data.payments.length > 0 ? data.payments : prev.payments,
          reminders: data.reminders && data.reminders.length > 0 ? data.reminders : prev.reminders,
          staff: data.staff && data.staff.length > 0 ? data.staff : prev.staff,
          parties: data.parties && data.parties.length > 0 ? data.parties : prev.parties,
        }));
        setLastSyncedAt(new Date().toLocaleTimeString());
        notify('Restored full cloud workspace data from Firestore.');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Cloud pull failed.', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [firebaseUser, notify]);

  return (
    <BusinessContext.Provider
      value={{
        ...state,
        activeModule,
        setActiveModule,
        activeOperator,
        hasPermission,
        switchOperator,
        theme,
        toggleTheme,
        toasts,
        notify,
        posQueuedSku,
        setPosQueuedSku,
        queuedEditSaleId,
        setQueuedEditSaleId,
        openSaleForEdit,
        updateProfile,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        addPurchase,
        payPurchaseBalance,
        deletePurchase,
        addSale,
        updateSale,
        dispatchSale,
        recordSalePayment,
        deleteSale,
        addReturn,
        deleteReturn,
        addPayment,
        deletePayment,
        addReminderLog,
        deleteReminderLog,
        updateReminderSettings,
        addStaffAccount,
        updateStaffAccount,
        deleteStaffAccount,
        addParty,
        updateParty,
        deleteParty,
        exportBackupJson,
        importBackupJson,
        resetDemoData,
        firebaseUser,
        authReady,
        isSyncing,
        lastSyncedAt,
        autoSyncEnabled,
        setAutoSyncEnabled,
        liveSyncActive,
        pendingOfflineSync,
        cloudSignIn,
        cloudSignOut,
        syncNowToCloud,
        pullFromCloudBackup,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
};

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
  return ctx;
}
