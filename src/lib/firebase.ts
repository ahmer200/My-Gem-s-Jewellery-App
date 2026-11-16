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
  getDocFromServer,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  CompanyProfile,
  InventoryItem,
  PaymentRecord,
  PurchaseRecord,
  ReminderLog,
  ReturnRecord,
  SalesOrder,
  StaffAccount,
} from '../types/business';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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

function safeDocId(raw: string): string {
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
}

export async function pushWorkspaceToCloud(uid: string, payload: SyncPayload): Promise<number> {
  const workspaceId = safeDocId(uid);
  const wsPath = `workspaces/${workspaceId}`;

  try {
    await setDoc(doc(db, wsPath), {
      ownerId: uid,
      companyName: payload.profile.companyName.slice(0, 160),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wsPath);
  }

  try {
    const profilePath = `${wsPath}/settings/profile`;
    await setDoc(doc(db, profilePath), {
      ownerId: uid,
      companyName: payload.profile.companyName.slice(0, 160),
      subtitle: payload.profile.subtitle.slice(0, 200),
      address: payload.profile.address.slice(0, 400),
      contact: payload.profile.contact.slice(0, 80),
      whatsapp: payload.profile.whatsapp.slice(0, 40),
      email: payload.profile.email.slice(0, 160),
      ntn: payload.profile.ntn.slice(0, 64),
      rmbToPkr: Number(payload.profile.rmbToPkr) || 0,
      usdToPkr: Number(payload.profile.usdToPkr) || 0,
      defaultMarkupPercent: Number(payload.profile.defaultMarkupPercent) || 0,
      invoiceFooter: payload.profile.invoiceFooter.slice(0, 500),
      logoDataUrl: (payload.profile.logoDataUrl || '').slice(0, 340000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${wsPath}/settings/profile`);
  }

  let syncedCount = 1;
  const batch = writeBatch(db);

  for (const item of payload.inventory) {
    const id = safeDocId(item.id);
    batch.set(doc(db, `${wsPath}/inventory/${id}`), {
      ownerId: uid,
      sku: item.sku.slice(0, 64),
      name: item.name.slice(0, 200),
      category: item.category.slice(0, 80),
      gemstoneType: item.gemstoneType.slice(0, 80),
      origin: item.origin.slice(0, 100),
      shapeCut: item.shapeCut.slice(0, 80),
      colour: item.colour.slice(0, 80),
      clarity: item.clarity.slice(0, 80),
      weightCarats: Number(item.weightCarats) || 0,
      sizeMm: item.sizeMm.slice(0, 60),
      treatment: item.treatment.slice(0, 100),
      certLab: item.certLab.slice(0, 60),
      certNumber: item.certNumber.slice(0, 80),
      stockQty: Number(item.stockQty) || 0,
      minStockAlert: Number(item.minStockAlert) || 0,
      vaultLocation: item.vaultLocation.slice(0, 80),
      supplierName: item.supplierName.slice(0, 140),
      costCurrency: item.costCurrency,
      unitCost: Number(item.unitCost) || 0,
      sellCurrency: item.sellCurrency,
      baseSellPrice: Number(item.baseSellPrice) || 0,
      imageUrl: (item.imageUrl || '').slice(0, 240000),
      notes: (item.notes || '').slice(0, 500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    syncedCount++;
  }

  for (const pur of payload.purchases) {
    const id = safeDocId(pur.id);
    batch.set(doc(db, `${wsPath}/purchases/${id}`), {
      ownerId: uid,
      referenceNo: pur.referenceNo.slice(0, 80),
      supplierName: pur.supplierName.slice(0, 140),
      supplierContact: pur.supplierContact.slice(0, 80),
      purchaseDate: pur.purchaseDate.slice(0, 40),
      currency: pur.currency,
      exchangeRateApplied: Number(pur.exchangeRateApplied) || 0,
      itemCostOrig: Number(pur.itemCostOrig) || 0,
      importCostOrig: Number(pur.importCostOrig) || 0,
      totalOrig: Number(pur.totalOrig) || 0,
      totalPkr: Number(pur.totalPkr) || 0,
      paidPkr: Number(pur.paidPkr) || 0,
      status: pur.status,
      itemsSummary: JSON.stringify(pur.items).slice(0, 1000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    syncedCount++;
  }

  for (const sale of payload.sales) {
    const id = safeDocId(sale.id);
    batch.set(doc(db, `${wsPath}/sales/${id}`), {
      ownerId: uid,
      invoiceNo: sale.invoiceNo.slice(0, 64),
      customerName: sale.customerName.slice(0, 140),
      customerPhone: sale.customerPhone.slice(0, 40),
      customerAddress: sale.customerAddress.slice(0, 300),
      orderDate: sale.orderDate.slice(0, 40),
      sourceCurrency: sale.sourceCurrency,
      rmbRateUsed: Number(sale.rmbRateUsed) || 0,
      usdRateUsed: Number(sale.usdRateUsed) || 0,
      markupPercentUsed: Number(sale.markupPercentUsed) || 0,
      finalCurrency: sale.finalCurrency,
      baseSubtotal: Number(sale.baseSubtotal) || 0,
      convertedAmountPkr: Number(sale.convertedAmountPkr) || 0,
      finalTotal: Number(sale.finalTotal) || 0,
      finalTotalPkrEquivalent: Number(sale.finalTotalPkrEquivalent) || 0,
      totalCostPkr: Number(sale.totalCostPkr) || 0,
      profitPkr: Number(sale.profitPkr) || 0,
      paidAmountPkr: Number(sale.paidAmountPkr) || 0,
      paymentStatus: sale.paymentStatus,
      itemsPayload: JSON.stringify(sale.items).slice(0, 11500),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    syncedCount++;
  }

  for (const ret of payload.returns) {
    const id = safeDocId(ret.id);
    batch.set(doc(db, `${wsPath}/returns/${id}`), {
      ownerId: uid,
      returnNo: ret.returnNo.slice(0, 64),
      invoiceNo: ret.invoiceNo.slice(0, 64),
      customerName: ret.customerName.slice(0, 140),
      sku: ret.sku.slice(0, 64),
      productName: ret.productName.slice(0, 200),
      quantity: Math.max(1, Number(ret.quantity) || 1),
      reason: ret.reason.slice(0, 300),
      restocked: Boolean(ret.restocked),
      refundCurrency: ret.refundCurrency,
      exchangeRateApplied: Number(ret.exchangeRateApplied) || 0,
      refundAmountOrig: Number(ret.refundAmountOrig) || 0,
      refundAmountPkr: Number(ret.refundAmountPkr) || 0,
      itemsPayload: ret.items ? JSON.stringify(ret.items).slice(0, 11500) : '[]',
      returnDate: ret.returnDate.slice(0, 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    syncedCount++;
  }

  for (const pay of payload.payments) {
    const id = safeDocId(pay.id);
    batch.set(doc(db, `${wsPath}/payments/${id}`), {
      ownerId: uid,
      type: pay.type,
      category: pay.category.slice(0, 80),
      partyName: pay.partyName.slice(0, 140),
      referenceNo: pay.referenceNo.slice(0, 80),
      currency: pay.currency,
      exchangeRateApplied: Number(pay.exchangeRateApplied) || 0,
      amountOrig: Number(pay.amountOrig) || 0,
      amountPkr: Number(pay.amountPkr) || 0,
      method: pay.method.slice(0, 60),
      paymentDate: pay.paymentDate.slice(0, 40),
      notes: (pay.notes || '').slice(0, 400),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    syncedCount++;
  }

  for (const rem of payload.reminders) {
    const id = safeDocId(rem.id);
    batch.set(doc(db, `${wsPath}/reminders/${id}`), {
      ownerId: uid,
      customerName: rem.customerName.slice(0, 140),
      customerPhone: (rem.customerPhone || '').slice(0, 40),
      invoiceNo: (rem.invoiceNo || '').slice(0, 64),
      channel: rem.channel,
      message: (rem.message || '').slice(0, 1000),
      sentDate: rem.sentDate.slice(0, 40),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    syncedCount++;
  }

  for (const st of payload.staff) {
    const id = safeDocId(st.id);
    batch.set(doc(db, `${wsPath}/staff/${id}`), {
      ownerId: uid,
      name: st.name.slice(0, 120),
      email: st.email.slice(0, 160),
      role: st.role,
      active: Boolean(st.active),
      permissionsList: st.permissions.join(',').slice(0, 600),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    syncedCount++;
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, wsPath);
  }

  return syncedCount;
}

export async function deleteCloudDocument(
  uid: string,
  subcollection: 'inventory' | 'purchases' | 'sales' | 'returns' | 'payments' | 'reminders' | 'staff',
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
    ] = await Promise.all([
      getDocs(collection(db, `${wsPath}/settings`)),
      getDocs(collection(db, `${wsPath}/inventory`)),
      getDocs(collection(db, `${wsPath}/purchases`)),
      getDocs(collection(db, `${wsPath}/sales`)),
      getDocs(collection(db, `${wsPath}/returns`)),
      getDocs(collection(db, `${wsPath}/payments`)),
      getDocs(collection(db, `${wsPath}/reminders`)),
      getDocs(collection(db, `${wsPath}/staff`)),
    ]);

    if (
      settingsSnap.empty &&
      invSnap.empty &&
      purSnap.empty &&
      salesSnap.empty &&
      retSnap.empty &&
      paySnap.empty &&
      remSnap.empty &&
      staffSnap.empty
    ) {
      return null;
    }

    const out: Partial<SyncPayload> = {};
    if (!settingsSnap.empty) {
      const p = settingsSnap.docs[0].data();
      out.profile = {
        companyName: p.companyName || "N.A GEM'S",
        subtitle: p.subtitle || '',
        address: p.address || '',
        contact: p.contact || '',
        whatsapp: p.whatsapp || '',
        email: p.email || '',
        ntn: p.ntn || '',
        rmbToPkr: Number(p.rmbToPkr) || 0,
        usdToPkr: Number(p.usdToPkr) || 0,
        defaultMarkupPercent: Number(p.defaultMarkupPercent) || 0,
        invoiceFooter: p.invoiceFooter || '',
        logoDataUrl: p.logoDataUrl || '',
      };
    }

    if (!invSnap.empty) {
      out.inventory = invSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sku: data.sku || '',
          name: data.name || '',
          category: data.category || 'Loose Gemstone',
          gemstoneType: data.gemstoneType || '',
          origin: data.origin || '',
          shapeCut: data.shapeCut || '',
          colour: data.colour || '',
          clarity: data.clarity || '',
          weightCarats: Number(data.weightCarats) || 0,
          sizeMm: data.sizeMm || '',
          treatment: data.treatment || '',
          certLab: data.certLab || '',
          certNumber: data.certNumber || '',
          stockQty: Number(data.stockQty) || 0,
          minStockAlert: Number(data.minStockAlert) || 1,
          vaultLocation: data.vaultLocation || '',
          supplierName: data.supplierName || '',
          costCurrency: data.costCurrency || 'PKR',
          unitCost: Number(data.unitCost) || 0,
          sellCurrency: data.sellCurrency || 'PKR',
          baseSellPrice: Number(data.baseSellPrice) || 0,
          imageUrl: data.imageUrl || undefined,
          notes: data.notes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });
    }

    if (!purSnap.empty) {
      out.purchases = purSnap.docs.map((d) => {
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
      });
    }

    if (!salesSnap.empty) {
      out.sales = salesSnap.docs.map((d) => {
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
          sourceCurrency === 'PKR'
            ? 1
            : rmbRateUsed === 0
              ? 0
              : sourceCurrency === 'RMB'
                ? rmbRateUsed
                : usdRateUsed;
        const preMarkup =
          finalCurrency === 'PKR' && sourceCurrency !== 'PKR' ? convertedAmountPkr : baseSubtotal;
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
          markupAmount: Math.max(0, finalTotal - preMarkup),
          finalTotal,
          finalTotalPkrEquivalent: Number(data.finalTotalPkrEquivalent) || finalTotal,
          totalCostPkr: Number(data.totalCostPkr) || 0,
          profitPkr: Number(data.profitPkr) || 0,
          paidAmountPkr: Number(data.paidAmountPkr) || 0,
          paymentStatus: data.paymentStatus || 'Paid',
          items: Array.isArray(parsedItems) ? parsedItems : [],
          createdBy: 'Cloud Sync',
          createdAt: new Date().toISOString(),
        };
      });
    }

    if (!retSnap.empty) {
      out.returns = retSnap.docs.map((d) => {
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
      });
    }

    if (!paySnap.empty) {
      out.payments = paySnap.docs.map((d) => {
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
      });
    }

    if (!remSnap.empty) {
      out.reminders = remSnap.docs.map((d) => {
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
      });
    }

    if (!staffSnap.empty) {
      out.staff = staffSnap.docs.map((d) => {
        const data = d.data();
        const perms = typeof data.permissionsList === 'string' && data.permissionsList
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
      });
    }

    return out;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, wsPath);
  }
}
