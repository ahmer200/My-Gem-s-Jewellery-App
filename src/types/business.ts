export type CurrencyCode = string;

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

export interface CategoryDefinition {
  id: string;
  name: string;
  nameUr?: string;
  subCategories: string[];
  createdAt: string;
  updatedAt: string;
}

export type UiLanguage = 'en' | 'ur_en';

export type SubscriptionPlan = 'free' | 'monthly' | 'yearly';

export type SubscriptionStatus =
  | 'free'
  | 'pending_verification'
  | 'active'
  | 'expired'
  | 'rejected';

export type SubscriptionFeatureKey =
  | 'stock_photo_upload'
  | 'daily_movement_report'
  | 'daily_amount_report'
  | 'category_management'
  | 'full_invoicing';

export interface SubscriptionState {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate?: string;
  expiryDate?: string;
  lastPaymentMethod?: 'EasyPaisa' | 'Meezan Bank IBFT / Raast';
  lastTransactionId?: string;
  updatedAt: string;
}

export interface PaymentVerificationRequest {
  id: string;
  ownerId: string;
  userEmail: string;
  userName: string;
  companyName: string;
  planType: 'monthly' | 'yearly';
  amountPkr: number;
  paymentMethod: 'EasyPaisa' | 'Meezan Bank IBFT / Raast';
  transactionId: string;
  senderAccount: string;
  status: 'pending' | 'verified' | 'rejected';
  adminNote?: string;
  submittedDate: string;
  startDate?: string;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfile {
  companyName: string;
  subtitle: string;
  address: string;
  contact: string;
  whatsapp: string;
  email: string;
  ntn: string;
  defaultCurrency: CurrencyCode;
  currencyRates: Record<string, number>;
  customCategoriesJson?: string;
  customUnitsJson?: string;
  subscriptionJson?: string;
  rmbToPkr?: number;
  usdToPkr?: number;
  defaultMarkupPercent: number;
  invoiceFooter: string;
  logoDataUrl: string;
}

export interface InventoryItem {
  id: string;
  sku: string; // 1. SKU (Auto-generated from Size, Sub-Category, Pcs & Batch #)
  name: string; // Product title / display label
  sizeMm: string; // 2. Size (mm)
  colour: string; // 3. Colour
  shapeCut: string; // 4. Shape
  subCategory: string; // 5. Sub-Category
  category: string; // 6. Category
  stockPieces: number; // 7. Stock Pieces
  itemUnit: string; // 8. Item Unit (Carat, Piece, Gram, Lot, Parcel)
  oneTpWeight: number; // 9. 1TP Weight
  batchNumber: string; // 10. Batch #
  stockQty: number; // 11. Stock Quantity
  cent: number; // 12. Cent
  fridge: string; // 13. Fridge
  costCurrency: CurrencyCode; // 14. Cost Currency
  costExchangeRate?: number; // Cost rate -> PKR (0 = keep in costCurrency)
  unitCost: number; // 14. Cost
  sellCurrency: CurrencyCode; // 15. Price Currency
  sellExchangeRate?: number; // Sell rate -> PKR (0 = keep in sellCurrency)
  baseSellPrice: number; // 15. Price
  via: string; // 16. Via (By Sea / By Air)
  purchaseDate: string; // 17. Purchase Date
  returnLossDamage: string; // 18. Return/Loss/Damage
  gemstoneType: string; // 19. Gemstone
  origin: string; // 20. Origin
  clarity: string; // 21. Clarity
  treatment: string; // 22. Treatment
  certLab: string; // 23. Cert Lab
  certNumber: string; // 24. Cert No.
  minStockAlert: number; // 25. Min Alert
  vaultLocation: string; // 26. Vault / Box
  supplierName: string; // 27. Supplier/ Carrier
  weightCarats: number; // Synced carat weight for QR labels & gem logs
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
  markupPercent?: number;
}

export interface SalesOrder {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderDate: string;
  sourceCurrency: CurrencyCode;
  rmbRateUsed?: number;
  usdRateUsed?: number;
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
  courierCharges?: number;
  dispatchStatus?: 'Pending' | 'Dispatched';
  expectedArrivalDate?: string;
  dispatchedAt?: string;
  items: SalesLineItem[];
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface ReturnLineItem {
  inventoryId?: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPriceOrig: number;
  percentAdjustment: number;
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
  items?: ReturnLineItem[];
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

export type PartyType = 'Customer' | 'Vendor' | 'Both';

export interface PartyAccount {
  id: string;
  partyType: PartyType;
  name: string;
  contactNumber: string;
  address: string;
  city: string;
  creditLimit: number;
  creditCurrency: CurrencyCode;
  creditExchangeRate?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ModuleId =
  | 'dashboard'
  | 'inventory'
  | 'categories'
  | 'purchases'
  | 'sales'
  | 'parties'
  | 'scanner'
  | 'returns'
  | 'payments'
  | 'reminders'
  | 'reports'
  | 'users'
  | 'subscription'
  | 'settings';

export interface AqsaAndroidBridgeApi {
  printCurrentPage?: (jobTitle: string) => void;
  isNativeAndroid?: () => boolean;
  getLiveAppUrl?: () => string;
  setLiveAppUrl?: (url: string) => void;
  isLiveSyncEnabled?: () => boolean;
  setLiveSyncEnabled?: (enabled: boolean) => void;
  reloadApp?: () => void;
}

declare global {
  const __APP_BUILD_ID__: string;
  const __APP_BUILT_AT__: string;

  interface Window {
    AqsaAndroidBridge?: AqsaAndroidBridgeApi;
  }
}
