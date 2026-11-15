export type CurrencyCode = 'RMB' | 'USD' | 'PKR';

export type UserRole = 'admin' | 'staff';

export type PermissionKey =
  | 'view_inventory'
  | 'edit_inventory'
  | 'create_sales'
  | 'process_returns'
  | 'record_purchases'
  | 'manage_payments'
  | 'send_reminders'
  | 'view_profit'
  | 'export_reports'
  | 'edit_rates_profile'
  | 'manage_users';

export interface CompanyProfile {
  companyName: string;
  subtitle: string;
  address: string;
  contact: string;
  whatsapp: string;
  email: string;
  ntn: string;
  rmbToPkr: number;
  usdToPkr: number;
  defaultMarkupPercent: number;
  invoiceFooter: string;
  logoDataUrl: string;
}

export interface InventoryItem {
  id: string;
  sku: string; // 1. SKU / Barcode
  name: string; // 2. Product Name
  category: string; // 3. Category
  gemstoneType: string; // 4. Gemstone Type
  origin: string; // 5. Origin
  shapeCut: string; // 6. Shape / Cut
  colour: string; // 7. Colour
  clarity: string; // 8. Clarity
  weightCarats: number; // 9. Weight (ct)
  sizeMm: string; // 10. Size (mm)
  treatment: string; // 11. Treatment
  certLab: string; // 12. Certificate Lab
  certNumber: string; // 13. Certificate No.
  stockQty: number; // 14. Stock Qty
  minStockAlert: number; // 15. Min Alert
  vaultLocation: string; // 16. Box / Vault
  supplierName: string; // 17. Supplier
  costCurrency: CurrencyCode; // 18. Cost Currency
  unitCost: number; // 19. Unit Cost (Orig.)
  sellCurrency: CurrencyCode; // 20. Sell Currency
  baseSellPrice: number; // 21. Base Sell Price (Orig.)
  // 22. Final PKR (w/ Markup) is computed dynamically via saved/item rates
  imageUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseLineItem {
  inventoryId?: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCostOrig: number;
}

export interface PurchaseRecord {
  id: string;
  referenceNo: string;
  supplierName: string;
  supplierContact: string;
  purchaseDate: string;
  currency: CurrencyCode;
  exchangeRateApplied: number;
  itemCostOrig: number;
  importCostOrig: number;
  totalOrig: number;
  totalPkr: number;
  paidPkr: number;
  status: 'Paid' | 'Partial' | 'Payable';
  items: PurchaseLineItem[];
  notes?: string;
  createdAt: string;
}

export interface SalesLineItem {
  inventoryId: string;
  sku: string;
  productName: string;
  gemstoneDetails: string;
  certNumber: string;
  quantity: number;
  unitPriceOrig: number;
  unitCostPkr: number;
}

export interface SalesOrder {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderDate: string;
  sourceCurrency: CurrencyCode;
  rmbRateUsed: number;
  usdRateUsed: number;
  markupPercentUsed: number;
  finalCurrency: CurrencyCode;
  exchangeRateApplied: number;
  baseSubtotal: number;
  convertedAmountPkr: number;
  markupAmount: number;
  finalTotal: number;
  finalTotalPkrEquivalent: number;
  totalCostPkr: number;
  profitPkr: number;
  paidAmountPkr: number;
  paymentStatus: 'Paid' | 'Partial' | 'Pending';
  items: SalesLineItem[];
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface ReturnRecord {
  id: string;
  returnNo: string;
  invoiceNo: string;
  customerName: string;
  inventoryId?: string;
  sku: string;
  productName: string;
  quantity: number;
  reason: string;
  restocked: boolean;
  refundCurrency: CurrencyCode;
  exchangeRateApplied: number;
  refundAmountOrig: number;
  refundAmountPkr: number;
  returnDate: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  type: 'Incoming' | 'Outgoing';
  category: string;
  partyName: string;
  referenceNo: string;
  currency: CurrencyCode;
  exchangeRateApplied: number;
  amountOrig: number;
  amountPkr: number;
  method: 'Cash' | 'Bank Transfer' | 'JazzCash / EasyPaisa' | 'Cheque' | 'WeChat / Alipay';
  paymentDate: string;
  notes?: string;
  createdAt: string;
}

export interface ReminderSettings {
  autoRemindDays: number;
  defaultChannel: 'WhatsApp' | 'SMS';
  messageTemplate: string;
}

export interface ReminderLog {
  id: string;
  customerName: string;
  customerPhone: string;
  invoiceNo: string;
  dueAmountLabel: string;
  channel: 'WhatsApp' | 'SMS';
  message: string;
  sentDate: string;
}

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  pin: string;
  role: UserRole;
  active: boolean;
  permissions: PermissionKey[];
  createdAt: string;
}

export type ModuleId =
  | 'dashboard'
  | 'inventory'
  | 'purchases'
  | 'sales'
  | 'scanner'
  | 'returns'
  | 'payments'
  | 'reminders'
  | 'reports'
  | 'users'
  | 'settings';
