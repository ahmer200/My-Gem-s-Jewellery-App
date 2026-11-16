import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  QueryDocumentSnapshot,
  serverTimestamp,
  Unsubscribe,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  CompanyProfile,
  InventoryItem,
  PartyAccount,
  PaymentRecord,
  PurchaseRecord,
  ReminderLog,
  ReturnRecord,
  SalesOrder,
  StaffAccount,
} from '../types/business';
import { DEFAULT_CURRENCY_RATES_PKR } from '../utils/worldCurrencies';

const app = initializeApp(firebaseConfig);

function createFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function safeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120) || 'doc_default';
}

export interface SyncPayload {
  profile: CompanyProfile;
  inventory: InventoryItem[];
  purchases: PurchaseRecord[];
  sales: SalesOrder[];
  returns: ReturnRecord[];
  payments: PaymentRecord[];
  reminders: ReminderLog[];
  staff: StaffAccount[];
  parties: PartyAccount[];
}

export interface CloudKnownState {
  workspaceExists: boolean;
  profileExists: boolean;
  inventoryIds: Set<string>;
  purchaseIds: Set<string>;
  saleDispatchMap: Map<string, 'Pending' | 'Dispatched'>;
  returnIds: Set<string>;
  paymentIds: Set<string>;
  reminderIds: Set<string>;
  staffIds: Set<string>;
  partyIds: Set<string>;
}

function createEmptyKnownState(): CloudKnownState {
  return {
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
}

function mapProfileData(p: DocumentData): CompanyProfile {
  let parsedRates: Record<string, number> = { ...DEFAULT_CURRENCY_RATES_PKR };
  if (typeof p.currencyRatesJson === 'string' && p.currencyRatesJson.trim()) {
    try {
      const obj = JSON.parse(p.currencyRatesJson);
      if (obj && typeof obj === 'object') {
        parsedRates = { ...parsedRates, ...obj };
      }
    } catch {
      // Keep default fallback map
    }
  }
  if (typeof p.rmbToPkr === 'number' && !parsedRates.CNY) parsedRates.CNY = p.rmbToPkr;
  if (typeof p.usdToPkr === 'number' && !parsedRates.USD) parsedRates.USD = p.usdToPkr;

  return {
    companyName: p.companyName || "N.A GEM'S",
    subtitle: p.subtitle || '',
    address: p.address || '',
    contact: p.contact || '',
    whatsapp: p.whatsapp || '',
    email: p.email || '',
    ntn: p.ntn || '',
    defaultCurrency: p.defaultCurrency || 'CNY',
    currencyRates: parsedRates,
    rmbToPkr: typeof p.rmbToPkr === 'number' ? p.rmbToPkr : parsedRates.CNY ?? 0,
    usdToPkr: typeof p.usdToPkr === 'number' ? p.usdToPkr : parsedRates.USD ?? 0,
    defaultMarkupPercent: Number(p.defaultMarkupPercent) || 0,
    invoiceFooter: p.invoiceFooter || '',
    logoDataUrl: p.logoDataUrl || '',
  };
}

function mapInventoryDoc(d: QueryDocumentSnapshot<DocumentData>): InventoryItem {
  const data = d.data();
  const oneTpWeight = Number(data.oneTpWeight ?? data.weightCarats) || 0;
  return {
    id: d.id,
    sku: data.sku || '',
    name: data.name || '',
    category: data.category || 'Loose Gemstone',
    subCategory: data.subCategory || '',
    gemstoneType: data.gemstoneType || '',
    origin: data.origin || '',
    shapeCut: data.shapeCut || '',
    colour: data.colour || '',
    clarity: data.clarity || '',
    weightCarats: Number(data.weightCarats ?? oneTpWeight) || 0,
    oneTpWeight,
    cent: Number(data.cent) || 0,
    sizeMm: data.sizeMm || '',
    stockPieces: Number(data.stockPieces ?? data.stockQty) || 0,
    itemUnit: data.itemUnit || 'Carats',
    batchNumber: data.batchNumber || '',
    fridge: data.fridge || '',
    via: data.via || 'By Air',
    purchaseDate: data.purchaseDate || '',
    returnLossDamage: data.returnLossDamage || '0',
    treatment: data.treatment || '',
    certLab: data.certLab || '',
    certNumber: data.certNumber || '',
    stockQty: Number(data.stockQty) || 0,
    minStockAlert: Number(data.minStockAlert) || 1,
    vaultLocation: data.vaultLocation || '',
    supplierName: data.supplierName || '',
    costCurrency: data.costCurrency || 'PKR',
    costExchangeRate:
      typeof data.costExchangeRate === 'number' ? data.costExchangeRate : undefined,
    unitCost: Number(data.unitCost) || 0,
    sellCurrency: data.sellCurrency || 'PKR',
    sellExchangeRate:
      typeof data.sellExchangeRate === 'number' ? data.sellExchangeRate : undefined,
    baseSellPrice: Number(data.baseSellPrice) || 0,
    imageUrl: data.imageUrl || undefined,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapPurchaseDoc(d: QueryDocumentSnapshot<DocumentData>): PurchaseRecord {
  const data = d.data();
  let parsedItems = [];
  try {
    parsedItems = data.itemsSummary ? JSON.parse(data.itemsSummary) : [];
  } catch {
    parsedItems = [];
  }
  return {
    id: d.id,
    referenceNo: data.referenceNo || '',
    supplierName: data.supplierName || '',
    supplierContact: data.supplierContact || '',
    purchaseDate: data.purchaseDate || '',
    currency: data.currency || 'PKR',
    exchangeRateApplied: Number(data.exchangeRateApplied) || 1,
    itemCostOrig: Number(data.itemCostOrig) || 0,
    importCostOrig: Number(data.importCostOrig) || 0,
    totalOrig: Number(data.totalOrig) || 0,
    totalPkr: Number(data.totalPkr) || 0,
    paidPkr: Number(data.paidPkr) || 0,
    status: data.status || 'Paid',
    items: Array.isArray(parsedItems) ? parsedItems : [],
    createdAt: new Date().toISOString(),
  };
}

function mapSaleDoc(d: QueryDocumentSnapshot<DocumentData>): SalesOrder {
  const data = d.data();
  let parsedItems = [];
  try {
    parsedItems = data.itemsPayload ? JSON.parse(data.itemsPayload) : [];
  } catch {
    parsedItems = [];
  }
  const sourceCurrency = data.sourceCurrency || 'PKR';
  const finalCurrency = data.finalCurrency || 'PKR';
  const rmbRateUsed = Number(data.rmbRateUsed) || 0;
  const usdRateUsed = Number(data.usdRateUsed) || 0;
  const baseSubtotal = Number(data.baseSubtotal) || 0;
  const convertedAmountPkr = Number(data.convertedAmountPkr) || 0;
  const finalTotal = Number(data.finalTotal) || 0;
  const exchangeRateApplied =
    typeof data.exchangeRateApplied === 'number'
      ? Math.max(0, data.exchangeRateApplied)
      : sourceCurrency === 'PKR'
        ? 1
        : rmbRateUsed === 0
          ? 0
          : sourceCurrency === 'RMB'
            ? rmbRateUsed
            : usdRateUsed;
  const preMarkup =
    finalCurrency === 'PKR' && sourceCurrency !== 'PKR' ? convertedAmountPkr : baseSubtotal;
  const courierCharges = Number(data.courierCharges) || 0;
  return {
    id: d.id,
    invoiceNo: data.invoiceNo || '',
    customerName: data.customerName || '',
    customerPhone: data.customerPhone || '',
    customerAddress: data.customerAddress || '',
    orderDate: data.orderDate || '',
    sourceCurrency,
    rmbRateUsed,
    usdRateUsed,
    markupPercentUsed: Number(data.markupPercentUsed) || 0,
    finalCurrency,
    exchangeRateApplied,
    baseSubtotal,
    convertedAmountPkr,
    markupAmount: Math.max(0, finalTotal - preMarkup - courierCharges),
    finalTotal,
    finalTotalPkrEquivalent: Number(data.finalTotalPkrEquivalent) || finalTotal,
    totalCostPkr: Number(data.totalCostPkr) || 0,
    profitPkr: Number(data.profitPkr) || 0,
    paidAmountPkr: Number(data.paidAmountPkr) || 0,
    paymentStatus: data.paymentStatus || 'Paid',
    courierCharges,
    dispatchStatus: data.dispatchStatus || 'Pending',
    expectedArrivalDate: data.expectedArrivalDate || undefined,
    dispatchedAt: data.dispatchedAt || undefined,
    notes: data.notes || undefined,
    items: Array.isArray(parsedItems) ? parsedItems : [],
    createdBy: 'Cloud Sync',
    createdAt: new Date().toISOString(),
  };
}

function mapReturnDoc(d: QueryDocumentSnapshot<DocumentData>): ReturnRecord {
  const data = d.data();
  let parsedItems = undefined;
  try {
    const raw = data.itemsPayload ? JSON.parse(data.itemsPayload) : undefined;
    if (Array.isArray(raw) && raw.length > 0) parsedItems = raw;
  } catch {
    parsedItems = undefined;
  }
  return {
    id: d.id,
    returnNo: data.returnNo || '',
    invoiceNo: data.invoiceNo || '',
    customerName: data.customerName || '',
    sku: data.sku || '',
    productName: data.productName || '',
    quantity: Number(data.quantity) || 1,
    reason: data.reason || '',
    restocked: Boolean(data.restocked),
    refundCurrency: data.refundCurrency || 'PKR',
    exchangeRateApplied: Number(data.exchangeRateApplied) || 1,
    refundAmountOrig: Number(data.refundAmountOrig) || 0,
    refundAmountPkr: Number(data.refundAmountPkr) || 0,
    items: parsedItems,
    returnDate: data.returnDate || '',
    createdAt: new Date().toISOString(),
  };
}

function mapPaymentDoc(d: QueryDocumentSnapshot<DocumentData>): PaymentRecord {
  const data = d.data();
  return {
    id: d.id,
    type: data.type || 'Incoming',
    category: data.category || '',
    partyName: data.partyName || '',
    referenceNo: data.referenceNo || '',
    currency: data.currency || 'PKR',
    exchangeRateApplied: Number(data.exchangeRateApplied) || 1,
    amountOrig: Number(data.amountOrig) || 0,
    amountPkr: Number(data.amountPkr) || 0,
    method: data.method || 'Cash',
    paymentDate: data.paymentDate || '',
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
  };
}

function mapReminderDoc(d: QueryDocumentSnapshot<DocumentData>): ReminderLog {
  const data = d.data();
  return {
    id: d.id,
    customerName: data.customerName || '',
    customerPhone: data.customerPhone || '',
    invoiceNo: data.invoiceNo || '',
    dueAmountLabel: '',
    channel: data.channel || 'WhatsApp',
    message: data.message || '',
    sentDate: data.sentDate || '',
  };
}

function mapStaffDoc(d: QueryDocumentSnapshot<DocumentData>): StaffAccount {
  const data = d.data();
  const perms =
    typeof data.permissionsList === 'string' && data.permissionsList
      ? (data.permissionsList.split(',') as StaffAccount['permissions'])
      : [];
  return {
    id: d.id,
    name: data.name || 'User',
    email: data.email || '',
    pin: '0000',
    role: data.role || 'staff',
    active: Boolean(data.active),
    permissions: perms,
    createdAt: new Date().toISOString(),
  };
}

function mapPartyDoc(d: QueryDocumentSnapshot<DocumentData>): PartyAccount {
  const data = d.data();
  return {
    id: d.id,
    partyType: data.partyType || 'Customer',
    name: data.name || '',
    contactNumber: data.contactNumber || '',
    address: data.address || '',
    city: data.city || '',
    creditLimit: Number(data.creditLimit) || 0,
    creditCurrency: data.creditCurrency || 'PKR',
    creditExchangeRate:
      typeof data.creditExchangeRate === 'number' ? data.creditExchangeRate : undefined,
    notes: data.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function fetchKnownCloudState(uid: string): Promise<CloudKnownState> {
  const workspaceId = safeDocId(uid);
  const wsPath = `workspaces/${workspaceId}`;
  const known = createEmptyKnownState();

  const [wsSnap, settingsSnap, invSnap, purSnap, salesSnap, retSnap, paySnap, remSnap, staffSnap, partiesSnap] =
    await Promise.all([
      getDoc(doc(db, wsPath)),
      getDocs(collection(db, `${wsPath}/settings`)),
      getDocs(collection(db, `${wsPath}/inventory`)),
      getDocs(collection(db, `${wsPath}/purchases`)),
      getDocs(collection(db, `${wsPath}/sales`)),
      getDocs(collection(db, `${wsPath}/returns`)),
      getDocs(collection(db, `${wsPath}/payments`)),
      getDocs(collection(db, `${wsPath}/reminders`)),
      getDocs(collection(db, `${wsPath}/staff`)),
      getDocs(collection(db, `${wsPath}/parties`)),
    ]);

  known.workspaceExists = wsSnap.exists();
  known.profileExists = settingsSnap.docs.some((d) => d.id === 'profile');
  invSnap.docs.forEach((d) => known.inventoryIds.add(d.id));
  purSnap.docs.forEach((d) => known.purchaseIds.add(d.id));
  salesSnap.docs.forEach((d) =>
    known.saleDispatchMap.set(d.id, (d.data().dispatchStatus as 'Pending' | 'Dispatched') || 'Pending')
  );
  retSnap.docs.forEach((d) => known.returnIds.add(d.id));
  paySnap.docs.forEach((d) => known.paymentIds.add(d.id));
  remSnap.docs.forEach((d) => known.reminderIds.add(d.id));
  staffSnap.docs.forEach((d) => known.staffIds.add(d.id));
  partiesSnap.docs.forEach((d) => known.partyIds.add(d.id));

  return known;
}

export async function pushWorkspaceToCloud(
  uid: string,
  payload: SyncPayload,
  knownOverride?: CloudKnownState
): Promise<number> {
  const workspaceId = safeDocId(uid);
  const wsPath = `workspaces/${workspaceId}`;

  let known = knownOverride;
  if (!known) {
    try {
      known = await fetchKnownCloudState(uid);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, wsPath);
    }
  }

  type WriteOp = {
    ref: ReturnType<typeof doc>;
    mode: 'set' | 'update';
    data: Record<string, unknown>;
  };
  const ops: WriteOp[] = [];

  // 1. Root workspace doc
  if (!known.workspaceExists) {
    ops.push({
      ref: doc(db, wsPath),
      mode: 'set',
      data: {
        ownerId: uid,
        companyName: (payload.profile.companyName || "N.A GEM'S").slice(0, 160),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  } else {
    ops.push({
      ref: doc(db, wsPath),
      mode: 'update',
      data: {
        companyName: (payload.profile.companyName || "N.A GEM'S").slice(0, 160),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // 2. Profile settings
  const ratesMap = payload.profile.currencyRates || DEFAULT_CURRENCY_RATES_PKR;
  const cnyRate = Math.max(
    0,
    Number(ratesMap.CNY ?? ratesMap.RMB ?? payload.profile.rmbToPkr) || 0
  );
  const usdRate = Math.max(0, Number(ratesMap.USD ?? payload.profile.usdToPkr) || 0);

  const profileMutable = {
    companyName: (payload.profile.companyName || "N.A GEM'S").slice(0, 160),
    subtitle: (payload.profile.subtitle || '').slice(0, 200),
    address: (payload.profile.address || '').slice(0, 400),
    contact: (payload.profile.contact || '').slice(0, 80),
    whatsapp: (payload.profile.whatsapp || '').slice(0, 40),
    email: (payload.profile.email || '').slice(0, 160),
    ntn: (payload.profile.ntn || '').slice(0, 64),
    defaultCurrency: (payload.profile.defaultCurrency || 'CNY').toUpperCase().slice(0, 6),
    currencyRatesJson: JSON.stringify(ratesMap).slice(0, 8000),
    rmbToPkr: cnyRate,
    usdToPkr: usdRate,
    defaultMarkupPercent: Math.min(1000, Math.max(0, Number(payload.profile.defaultMarkupPercent) || 0)),
    invoiceFooter: (payload.profile.invoiceFooter || '').slice(0, 500),
    logoDataUrl: (payload.profile.logoDataUrl || '').slice(0, 340000),
  };
  if (!known.profileExists) {
    ops.push({
      ref: doc(db, `${wsPath}/settings/profile`),
      mode: 'set',
      data: {
        ownerId: uid,
        ...profileMutable,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  } else {
    ops.push({
      ref: doc(db, `${wsPath}/settings/profile`),
      mode: 'update',
      data: {
        ...profileMutable,
        updatedAt: serverTimestamp(),
      },
    });
  }

  // 3. Inventory
  for (const item of payload.inventory) {
    const id = safeDocId(item.id);
    const mutable: Record<string, unknown> = {
      sku: (item.sku || id).slice(0, 64),
      name: (item.name || item.sku || 'Unnamed Item').slice(0, 200),
      category: (item.category || '').slice(0, 80),
      subCategory: (item.subCategory || '').slice(0, 80),
      gemstoneType: (item.gemstoneType || '').slice(0, 80),
      origin: (item.origin || '').slice(0, 100),
      shapeCut: (item.shapeCut || '').slice(0, 80),
      colour: (item.colour || '').slice(0, 80),
      clarity: (item.clarity || '').slice(0, 80),
      weightCarats: Math.max(0, Number(item.weightCarats ?? item.oneTpWeight) || 0),
      oneTpWeight: Math.max(0, Number(item.oneTpWeight ?? item.weightCarats) || 0),
      cent: Math.max(0, Number(item.cent) || 0),
      sizeMm: (item.sizeMm || '').slice(0, 60),
      stockPieces: Math.max(0, Number(item.stockPieces) || 0),
      itemUnit: (item.itemUnit || 'Carats').slice(0, 40),
      batchNumber: (item.batchNumber || '').slice(0, 64),
      fridge: (item.fridge || '').slice(0, 80),
      via: (item.via || '').slice(0, 40),
      purchaseDate: (item.purchaseDate || '').slice(0, 40),
      returnLossDamage: (item.returnLossDamage || '').slice(0, 100),
      treatment: (item.treatment || '').slice(0, 100),
      certLab: (item.certLab || '').slice(0, 60),
      certNumber: (item.certNumber || '').slice(0, 80),
      stockQty: Math.max(0, Number(item.stockQty) || 0),
      minStockAlert: Math.max(0, Number(item.minStockAlert) || 0),
      vaultLocation: (item.vaultLocation || '').slice(0, 80),
      supplierName: (item.supplierName || '').slice(0, 140),
      costCurrency: (item.costCurrency || 'PKR').toUpperCase().slice(0, 6),
      unitCost: Math.max(0, Number(item.unitCost) || 0),
      sellCurrency: (item.sellCurrency || 'PKR').toUpperCase().slice(0, 6),
      baseSellPrice: Math.max(0, Number(item.baseSellPrice) || 0),
      imageUrl: (item.imageUrl || '').slice(0, 240000),
      notes: (item.notes || '').slice(0, 500),
    };
    if (typeof item.costExchangeRate === 'number') {
      mutable.costExchangeRate = Math.max(0, item.costExchangeRate);
    }
    if (typeof item.sellExchangeRate === 'number') {
      mutable.sellExchangeRate = Math.max(0, item.sellExchangeRate);
    }
    if (!known.inventoryIds.has(id)) {
      ops.push({
        ref: doc(db, `${wsPath}/inventory/${id}`),
        mode: 'set',
        data: { ownerId: uid, ...mutable, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      });
    } else {
      ops.push({
        ref: doc(db, `${wsPath}/inventory/${id}`),
        mode: 'update',
        data: { ...mutable, updatedAt: serverTimestamp() },
      });
    }
  }

  // 4. Purchases
  for (const pur of payload.purchases) {
    const id = safeDocId(pur.id);
    if (!known.purchaseIds.has(id)) {
      ops.push({
        ref: doc(db, `${wsPath}/purchases/${id}`),
        mode: 'set',
        data: {
          ownerId: uid,
          referenceNo: (pur.referenceNo || id).slice(0, 80),
          supplierName: (pur.supplierName || 'Supplier').slice(0, 140),
          supplierContact: (pur.supplierContact || '').slice(0, 80),
          purchaseDate: (pur.purchaseDate || '').slice(0, 40),
          currency: pur.currency,
          exchangeRateApplied: Math.max(0, Number(pur.exchangeRateApplied) || 0),
          itemCostOrig: Math.max(0, Number(pur.itemCostOrig) || 0),
          importCostOrig: Math.max(0, Number(pur.importCostOrig) || 0),
          totalOrig: Math.max(0, Number(pur.totalOrig) || 0),
          totalPkr: Math.max(0, Number(pur.totalPkr) || 0),
          paidPkr: Math.max(0, Number(pur.paidPkr) || 0),
          status: pur.status,
          itemsSummary: JSON.stringify(pur.items).slice(0, 1000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    } else {
      ops.push({
        ref: doc(db, `${wsPath}/purchases/${id}`),
        mode: 'update',
        data: {
          paidPkr: Math.max(0, Number(pur.paidPkr) || 0),
          status: pur.status,
          itemsSummary: JSON.stringify(pur.items).slice(0, 1000),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  // 5. Sales (respects Pending vs Dispatched rule gates)
  for (const sale of payload.sales) {
    const id = safeDocId(sale.id);
    const cloudDispatch = known.saleDispatchMap.get(id);
    if (!cloudDispatch) {
      ops.push({
        ref: doc(db, `${wsPath}/sales/${id}`),
        mode: 'set',
        data: {
          ownerId: uid,
          invoiceNo: (sale.invoiceNo || id).slice(0, 64),
          customerName: (sale.customerName || 'Walk-in Customer').slice(0, 140),
          customerPhone: (sale.customerPhone || '').slice(0, 40),
          customerAddress: (sale.customerAddress || '').slice(0, 300),
          orderDate: (sale.orderDate || '').slice(0, 40),
          sourceCurrency: (sale.sourceCurrency || 'PKR').toUpperCase().slice(0, 6),
          rmbRateUsed: Math.max(0, Number(sale.rmbRateUsed) || 0),
          usdRateUsed: Math.max(0, Number(sale.usdRateUsed) || 0),
          markupPercentUsed: Math.max(0, Number(sale.markupPercentUsed) || 0),
          finalCurrency: (sale.finalCurrency || 'PKR').toUpperCase().slice(0, 6),
          exchangeRateApplied: Math.max(0, Number(sale.exchangeRateApplied) || 0),
          baseSubtotal: Math.max(0, Number(sale.baseSubtotal) || 0),
          convertedAmountPkr: Math.max(0, Number(sale.convertedAmountPkr) || 0),
          finalTotal: Math.max(0, Number(sale.finalTotal) || 0),
          finalTotalPkrEquivalent: Math.max(0, Number(sale.finalTotalPkrEquivalent) || 0),
          totalCostPkr: Math.max(0, Number(sale.totalCostPkr) || 0),
          profitPkr: Number(sale.profitPkr) || 0,
          paidAmountPkr: Math.max(0, Number(sale.paidAmountPkr) || 0),
          paymentStatus: sale.paymentStatus,
          courierCharges: Math.max(0, Number(sale.courierCharges) || 0),
          dispatchStatus: sale.dispatchStatus || 'Pending',
          expectedArrivalDate: (sale.expectedArrivalDate || '').slice(0, 40),
          dispatchedAt: (sale.dispatchedAt || '').slice(0, 60),
          notes: (sale.notes || '').slice(0, 500),
          itemsPayload: JSON.stringify(sale.items).slice(0, 11500),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    } else if (cloudDispatch === 'Dispatched') {
      ops.push({
        ref: doc(db, `${wsPath}/sales/${id}`),
        mode: 'update',
        data: {
          paidAmountPkr: Math.max(0, Number(sale.paidAmountPkr) || 0),
          paymentStatus: sale.paymentStatus,
          updatedAt: serverTimestamp(),
        },
      });
    } else {
      ops.push({
        ref: doc(db, `${wsPath}/sales/${id}`),
        mode: 'update',
        data: {
          customerName: (sale.customerName || 'Walk-in Customer').slice(0, 140),
          customerPhone: (sale.customerPhone || '').slice(0, 40),
          customerAddress: (sale.customerAddress || '').slice(0, 300),
          orderDate: (sale.orderDate || '').slice(0, 40),
          sourceCurrency: (sale.sourceCurrency || 'PKR').toUpperCase().slice(0, 6),
          rmbRateUsed: Math.max(0, Number(sale.rmbRateUsed) || 0),
          usdRateUsed: Math.max(0, Number(sale.usdRateUsed) || 0),
          markupPercentUsed: Math.max(0, Number(sale.markupPercentUsed) || 0),
          finalCurrency: (sale.finalCurrency || 'PKR').toUpperCase().slice(0, 6),
          exchangeRateApplied: Math.max(0, Number(sale.exchangeRateApplied) || 0),
          baseSubtotal: Math.max(0, Number(sale.baseSubtotal) || 0),
          convertedAmountPkr: Math.max(0, Number(sale.convertedAmountPkr) || 0),
          finalTotal: Math.max(0, Number(sale.finalTotal) || 0),
          finalTotalPkrEquivalent: Math.max(0, Number(sale.finalTotalPkrEquivalent) || 0),
          totalCostPkr: Math.max(0, Number(sale.totalCostPkr) || 0),
          profitPkr: Number(sale.profitPkr) || 0,
          paidAmountPkr: Math.max(0, Number(sale.paidAmountPkr) || 0),
          paymentStatus: sale.paymentStatus,
          courierCharges: Math.max(0, Number(sale.courierCharges) || 0),
          dispatchStatus: sale.dispatchStatus || 'Pending',
          expectedArrivalDate: (sale.expectedArrivalDate || '').slice(0, 40),
          dispatchedAt: (sale.dispatchedAt || '').slice(0, 60),
          notes: (sale.notes || '').slice(0, 500),
          itemsPayload: JSON.stringify(sale.items).slice(0, 11500),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  // 6. Returns
  for (const ret of payload.returns) {
    const id = safeDocId(ret.id);
    if (!known.returnIds.has(id)) {
      ops.push({
        ref: doc(db, `${wsPath}/returns/${id}`),
        mode: 'set',
        data: {
          ownerId: uid,
          returnNo: (ret.returnNo || id).slice(0, 64),
          invoiceNo: (ret.invoiceNo || '').slice(0, 64),
          customerName: (ret.customerName || '').slice(0, 140),
          sku: (ret.sku || '').slice(0, 64),
          productName: (ret.productName || 'Returned Item').slice(0, 200),
          quantity: Math.max(1, Number(ret.quantity) || 1),
          reason: (ret.reason || '').slice(0, 300),
          restocked: Boolean(ret.restocked),
          refundCurrency: ret.refundCurrency,
          exchangeRateApplied: Math.max(0, Number(ret.exchangeRateApplied) || 0),
          refundAmountOrig: Math.max(0, Number(ret.refundAmountOrig) || 0),
          refundAmountPkr: Math.max(0, Number(ret.refundAmountPkr) || 0),
          itemsPayload: ret.items ? JSON.stringify(ret.items).slice(0, 11500) : '[]',
          returnDate: (ret.returnDate || '').slice(0, 40),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    } else {
      ops.push({
        ref: doc(db, `${wsPath}/returns/${id}`),
        mode: 'update',
        data: {
          reason: (ret.reason || '').slice(0, 300),
          restocked: Boolean(ret.restocked),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  // 7. Payments
  for (const pay of payload.payments) {
    const id = safeDocId(pay.id);
    if (!known.paymentIds.has(id)) {
      ops.push({
        ref: doc(db, `${wsPath}/payments/${id}`),
        mode: 'set',
        data: {
          ownerId: uid,
          type: pay.type,
          category: (pay.category || '').slice(0, 80),
          partyName: (pay.partyName || 'Party').slice(0, 140),
          referenceNo: (pay.referenceNo || '').slice(0, 80),
          currency: pay.currency,
          exchangeRateApplied: Math.max(0, Number(pay.exchangeRateApplied) || 0),
          amountOrig: Math.max(0, Number(pay.amountOrig) || 0),
          amountPkr: Math.max(0, Number(pay.amountPkr) || 0),
          method: (pay.method || 'Cash').slice(0, 60),
          paymentDate: (pay.paymentDate || '').slice(0, 40),
          notes: (pay.notes || '').slice(0, 400),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    } else {
      ops.push({
        ref: doc(db, `${wsPath}/payments/${id}`),
        mode: 'update',
        data: {
          notes: (pay.notes || '').slice(0, 400),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  // 8. Reminders (append-only in firestore.rules: allow update: if false)
  for (const rem of payload.reminders) {
    const id = safeDocId(rem.id);
    if (!known.reminderIds.has(id)) {
      ops.push({
        ref: doc(db, `${wsPath}/reminders/${id}`),
        mode: 'set',
        data: {
          ownerId: uid,
          customerName: (rem.customerName || 'Customer').slice(0, 140),
          customerPhone: (rem.customerPhone || '').slice(0, 40),
          invoiceNo: (rem.invoiceNo || '').slice(0, 64),
          channel: rem.channel,
          message: (rem.message || '').slice(0, 1000),
          sentDate: (rem.sentDate || '').slice(0, 40),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
    }
  }

  // 9. Staff
  for (const st of payload.staff) {
    const id = safeDocId(st.id);
    const mutable = {
      name: (st.name || 'Staff').slice(0, 120),
      email: (st.email || '').slice(0, 160),
      role: st.role,
      active: Boolean(st.active),
      permissionsList: st.permissions.join(',').slice(0, 600),
    };
    if (!known.staffIds.has(id)) {
      ops.push({
        ref: doc(db, `${wsPath}/staff/${id}`),
        mode: 'set',
        data: { ownerId: uid, ...mutable, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      });
    } else {
      ops.push({
        ref: doc(db, `${wsPath}/staff/${id}`),
        mode: 'update',
        data: { ...mutable, updatedAt: serverTimestamp() },
      });
    }
  }

  // 10. Parties (Customers & Vendors)
  for (const party of payload.parties) {
    const id = safeDocId(party.id);
    const mutable: Record<string, unknown> = {
      partyType: party.partyType,
      name: (party.name || 'Party').slice(0, 160),
      contactNumber: (party.contactNumber || '').slice(0, 60),
      address: (party.address || '').slice(0, 400),
      city: (party.city || '').slice(0, 100),
      creditLimit: Math.max(0, Number(party.creditLimit) || 0),
      creditCurrency: (party.creditCurrency || 'PKR').toUpperCase().slice(0, 6),
      notes: (party.notes || '').slice(0, 500),
    };
    if (typeof party.creditExchangeRate === 'number') {
      mutable.creditExchangeRate = Math.max(0, party.creditExchangeRate);
    }
    if (!known.partyIds.has(id)) {
      ops.push({
        ref: doc(db, `${wsPath}/parties/${id}`),
        mode: 'set',
        data: { ownerId: uid, ...mutable, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      });
    } else {
      ops.push({
        ref: doc(db, `${wsPath}/parties/${id}`),
        mode: 'update',
        data: { ...mutable, updatedAt: serverTimestamp() },
      });
    }
  }

  // Commit in chunks <= 400 operations per batch
  const CHUNK_SIZE = 400;
  try {
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const slice = ops.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const op of slice) {
        if (op.mode === 'set') {
          batch.set(op.ref, op.data);
        } else {
          batch.update(op.ref, op.data);
        }
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wsPath);
  }

  return ops.length;
}

export async function deleteCloudDocument(
  uid: string,
  subcollection: 'inventory' | 'purchases' | 'sales' | 'returns' | 'payments' | 'reminders' | 'staff' | 'parties',
  docId: string
): Promise<void> {
  const workspaceId = safeDocId(uid);
  const id = safeDocId(docId);
  const targetPath = `workspaces/${workspaceId}/${subcollection}/${id}`;
  try {
    await deleteDoc(doc(db, targetPath));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, targetPath);
  }
}

export async function pullWorkspaceFromCloud(uid: string): Promise<Partial<SyncPayload> | null> {
  const workspaceId = safeDocId(uid);
  const wsPath = `workspaces/${workspaceId}`;

  try {
    const [
      settingsSnap,
      invSnap,
      purSnap,
      salesSnap,
      retSnap,
      paySnap,
      remSnap,
      staffSnap,
      partiesSnap,
    ] = await Promise.all([
      getDocs(collection(db, `${wsPath}/settings`)),
      getDocs(collection(db, `${wsPath}/inventory`)),
      getDocs(collection(db, `${wsPath}/purchases`)),
      getDocs(collection(db, `${wsPath}/sales`)),
      getDocs(collection(db, `${wsPath}/returns`)),
      getDocs(collection(db, `${wsPath}/payments`)),
      getDocs(collection(db, `${wsPath}/reminders`)),
      getDocs(collection(db, `${wsPath}/staff`)),
      getDocs(collection(db, `${wsPath}/parties`)),
    ]);

    if (
      settingsSnap.empty &&
      invSnap.empty &&
      purSnap.empty &&
      salesSnap.empty &&
      retSnap.empty &&
      paySnap.empty &&
      remSnap.empty &&
      staffSnap.empty &&
      partiesSnap.empty
    ) {
      return null;
    }

    const out: Partial<SyncPayload> = {};
    if (!settingsSnap.empty) out.profile = mapProfileData(settingsSnap.docs[0].data());
    if (!invSnap.empty) out.inventory = invSnap.docs.map(mapInventoryDoc);
    if (!purSnap.empty) out.purchases = purSnap.docs.map(mapPurchaseDoc);
    if (!salesSnap.empty) out.sales = salesSnap.docs.map(mapSaleDoc);
    if (!retSnap.empty) out.returns = retSnap.docs.map(mapReturnDoc);
    if (!paySnap.empty) out.payments = paySnap.docs.map(mapPaymentDoc);
    if (!remSnap.empty) out.reminders = remSnap.docs.map(mapReminderDoc);
    if (!staffSnap.empty) out.staff = staffSnap.docs.map(mapStaffDoc);
    if (!partiesSnap.empty) out.parties = partiesSnap.docs.map(mapPartyDoc);

    return out;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, wsPath);
  }
}

export interface WorkspaceRealtimeCallbacks {
  knownState: CloudKnownState;
  onProfile: (profile: CompanyProfile) => void;
  onInventory: (items: InventoryItem[]) => void;
  onPurchases: (items: PurchaseRecord[]) => void;
  onSales: (items: SalesOrder[]) => void;
  onReturns: (items: ReturnRecord[]) => void;
  onPayments: (items: PaymentRecord[]) => void;
  onReminders: (items: ReminderLog[]) => void;
  onStaff: (items: StaffAccount[]) => void;
  onParties: (items: PartyAccount[]) => void;
  onInitialSyncCheck: (isWorkspaceEmpty: boolean) => void;
  onError: (err: unknown, path: string) => void;
}

export function subscribeToWorkspace(
  uid: string,
  callbacks: WorkspaceRealtimeCallbacks
): Unsubscribe {
  const workspaceId = safeDocId(uid);
  const wsPath = `workspaces/${workspaceId}`;
  const { knownState } = callbacks;

  const settled = new Set<string>();
  let initialCheckFired = false;

  const markSettled = (key: string) => {
    settled.add(key);
    if (!initialCheckFired && settled.size === 10) {
      initialCheckFired = true;
      const isEmpty =
        !knownState.workspaceExists &&
        !knownState.profileExists &&
        knownState.inventoryIds.size === 0 &&
        knownState.purchaseIds.size === 0 &&
        knownState.saleDispatchMap.size === 0 &&
        knownState.returnIds.size === 0 &&
        knownState.paymentIds.size === 0 &&
        knownState.reminderIds.size === 0 &&
        knownState.staffIds.size === 0 &&
        knownState.partyIds.size === 0;
      callbacks.onInitialSyncCheck(isEmpty);
    }
  };

  const reportError = (err: unknown, path: string) => {
    try {
      handleFirestoreError(err, OperationType.GET, path);
    } catch (wrapped) {
      callbacks.onError(wrapped, path);
    }
  };

  const unsubs: Unsubscribe[] = [];

  unsubs.push(
    onSnapshot(
      doc(db, wsPath),
      (snap) => {
        knownState.workspaceExists = snap.exists();
        markSettled('root');
      },
      (err) => reportError(err, wsPath)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${wsPath}/settings`),
      (snap) => {
        const profileDoc = snap.docs.find((d) => d.id === 'profile') || snap.docs[0];
        knownState.profileExists = snap.docs.some((d) => d.id === 'profile');
        if (profileDoc && !snap.metadata.hasPendingWrites) {
          callbacks.onProfile(mapProfileData(profileDoc.data()));
        }
        markSettled('settings');
      },
      (err) => reportError(err, `${wsPath}/settings`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${wsPath}/inventory`),
      (snap) => {
        knownState.inventoryIds = new Set(snap.docs.map((d) => d.id));
        if (!snap.metadata.hasPendingWrites && (knownState.profileExists || !snap.empty)) {
          callbacks.onInventory(snap.docs.map(mapInventoryDoc));
        }
        markSettled('inventory');
      },
      (err) => reportError(err, `${wsPath}/inventory`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${wsPath}/purchases`),
      (snap) => {
        knownState.purchaseIds = new Set(snap.docs.map((d) => d.id));
        if (!snap.metadata.hasPendingWrites && (knownState.profileExists || !snap.empty)) {
          callbacks.onPurchases(snap.docs.map(mapPurchaseDoc));
        }
        markSettled('purchases');
      },
      (err) => reportError(err, `${wsPath}/purchases`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${wsPath}/sales`),
      (snap) => {
        const map = new Map<string, 'Pending' | 'Dispatched'>();
        snap.docs.forEach((d) =>
          map.set(d.id, (d.data().dispatchStatus as 'Pending' | 'Dispatched') || 'Pending')
        );
        knownState.saleDispatchMap = map;
        if (!snap.metadata.hasPendingWrites && (knownState.profileExists || !snap.empty)) {
          callbacks.onSales(snap.docs.map(mapSaleDoc));
        }
        markSettled('sales');
      },
      (err) => reportError(err, `${wsPath}/sales`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${wsPath}/returns`),
      (snap) => {
        knownState.returnIds = new Set(snap.docs.map((d) => d.id));
        if (!snap.metadata.hasPendingWrites && (knownState.profileExists || !snap.empty)) {
          callbacks.onReturns(snap.docs.map(mapReturnDoc));
        }
        markSettled('returns');
      },
      (err) => reportError(err, `${wsPath}/returns`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${wsPath}/payments`),
      (snap) => {
        knownState.paymentIds = new Set(snap.docs.map((d) => d.id));
        if (!snap.metadata.hasPendingWrites && (knownState.profileExists || !snap.empty)) {
          callbacks.onPayments(snap.docs.map(mapPaymentDoc));
        }
        markSettled('payments');
      },
      (err) => reportError(err, `${wsPath}/payments`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${wsPath}/reminders`),
      (snap) => {
        knownState.reminderIds = new Set(snap.docs.map((d) => d.id));
        if (!snap.metadata.hasPendingWrites && (knownState.profileExists || !snap.empty)) {
          callbacks.onReminders(snap.docs.map(mapReminderDoc));
        }
        markSettled('reminders');
      },
      (err) => reportError(err, `${wsPath}/reminders`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${wsPath}/staff`),
      (snap) => {
        knownState.staffIds = new Set(snap.docs.map((d) => d.id));
        if (!snap.metadata.hasPendingWrites && !snap.empty) {
          callbacks.onStaff(snap.docs.map(mapStaffDoc));
        }
        markSettled('staff');
      },
      (err) => reportError(err, `${wsPath}/staff`)
    )
  );

  unsubs.push(
    onSnapshot(
      collection(db, `${wsPath}/parties`),
      (snap) => {
        knownState.partyIds = new Set(snap.docs.map((d) => d.id));
        if (!snap.metadata.hasPendingWrites && (knownState.profileExists || !snap.empty)) {
          callbacks.onParties(snap.docs.map(mapPartyDoc));
        }
        markSettled('parties');
      },
      (err) => reportError(err, `${wsPath}/parties`)
    )
  );

  return () => {
    unsubs.forEach((unsub) => unsub());
  };
}
