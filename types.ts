
export type Department = 'large-format' | 'dtf' | 'embroidery' | 'bizhub' | 'supplies' | 'products';
export type AssignedDepartment = Department | 'Unassigned';
export type StockUnit = 'roll' | 'ream' | 'packet' | 'bottle' | 'cartridge' | 'cone' | 'pcs';

export interface ProductCategory {
  isActive?: boolean;
  id: string;
  name: string; // e.g. "Tshirt"
  module: string; // e.g. "embroidery", "bizhub"
  field1?: string; // e.g. "Neck Type"
  field1Options?: string[]; // e.g. ["V-Neck", "Round", "Collared"]
  field2?: string; // e.g. "Brand"
  field2Options?: string[];
  field3?: string; // e.g. "Body Color"
  field3Options?: string[];
  field4?: string; // e.g. "Material"
  field4Options?: string[];
  field5?: string; // e.g. "Size"
  field5Options?: string[];
}

export interface InventoryItem {
  isActive?: boolean;
  id: string;
  name: string;
  category: string; // Links to ProductCategory name
  module: string; // Business unit this belongs to
  quantity: number;
  price: number; // Selling Price (Preferred)
  minPrice: number; // Minimum negotiated price allowed
  purchasePrice?: number; // Cost Price for profit tracking
  avgCost?: number;
  costMissing?: boolean;
  sku: string;
  minStockLevel: number;
  /** @deprecated Removed when legacy usage screens are replaced. */
  isConsumable?: boolean;
  // Dynamic attributes based on setup
  attr1?: string;
  attr2?: string;
  attr3?: string;
  attr4?: string;
  attr5?: string;
  // Specific attributes used in some views for product variants
  variantType?: string;
  companyType?: string;
  bodyColor?: string;
  collarColor?: string;
}

export interface SaleItem {
  /** Explicit unopened material resale; dimension/service lines never populate this. */
  materialSkuId?: string;
  stockEntity?: 'material' | 'product';
  module?: AssignedDepartment;
  cogsAtSale?: number;
  directCosts?: { buyingPrice: number; otherCost: number; otherDescription: string; otherRows?: { description: string; amount: number }[] };
  showComplementaryOnInvoice?: boolean;
  complementaryFor?: string;
  complementaryUnitPrice?: number;
  complementaryQuantityPerItem?: number;
  productId?: string;
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  metadata?: {
    type: 'dimension' | 'simple' | 'manual';
    tab: string;
    length?: number;
    lengthUnit?: string;
    width?: number;
    widthUnit?: string;
    selectedStockItem?: string;
    selectedTier?: string;
    negotiatedDimPrice?: number;
    extraAmount?: number;
    extraAmountLabel?: string;
    dtfPreset?: 'A4' | 'A3' | null;
    selectedProductCategory?: string;
    selectedProductId?: string;
    negotiatedPrice?: number;
    manualItemName?: string;
    manualPrice?: number;
    manualQuantity?: number;
  };
}

export interface Customer {
  category?: string;
  district?: string;
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  careOf?: string;
  createdAt: string;
  totalSpent?: number;
  outstandingDebt?: number;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  recordedBy: string;
  note?: string;
}

export interface Sale {
  internalComplementary?: boolean;
  parentSaleId?: string;
  id: string;
  date: string;
  items: SaleItem[];
  customerId: string;
  total: number; // Final grand total after discount
  subtotal?: number; // Total before discount
  discount?: number; // Amount discounted
  taxPercent?: number;
  amountPaid?: number;
  status: 'Paid' | 'Unpaid' | 'Pending' | 'Partially Paid';
  userId: string;
  userName?: string;
  payments?: Payment[];
  /** @deprecated Legacy meter usage only. */
  usageLogged?: boolean;
  inventoryVersion?: 1;
  voidedAt?: string;
  inventoryMovementIds?: string[];
  notes?: string;
  rules?: string[];
  careOf?: string;
}

export interface Quotation {
  id: string;
  date: string;
  items: SaleItem[];
  customerId: string;
  subtotal: number;
  discount: number;
  taxPercent?: number;
  total: number;
  userId: string;
  userName?: string;
  notes?: string;
  rules?: string[];
  careOf?: string;
  isDuplicate?: boolean;
}

export interface Expense {
  module?: AssignedDepartment;
  expenseType?: 'operating';
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  userId: string;
  userName?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  isBanker?: boolean;
}

export interface MaterialCategory {
  unitType?: StockUnit;
  id: string;
  name: string;
  isActive: boolean;
  module: string; // Business unit
}

export interface StockItem {
  /** Selling price per whole unopened unit; quantities and costs remain on this material. */
  resalePrice?: number;
  reorderLevelNeedsReview?: boolean;
  /** Firestore document identity; skuId is retained for Calculator compatibility. */
  id?: string;
  unit?: StockUnit;
  unitsOnHand?: number;
  avgCostPerUnit?: number;
  variantLabel?: string;
  rollLengthMeters?: number;
  isActive?: boolean;
  inventoryVersion?: 1;
  skuId: string;
  categoryId: string;
  module: string; // Business unit
  width: number; // in meters
  itemName: string;
  /** @deprecated Read only migration input. */
  totalStockMeters: number;
  reorderLevel: number;
  /** @deprecated Read only migration input. */
  lastPurchasePricePerRoll_UGX: number;
}

export interface LegacyStockTransaction {
  id?: string;
  transactionId: string;
  skuId: string;
  /** @deprecated Legacy meter movement. */
  transactionType: 'Stock-In' | 'Stock-Out';
  quantityMeters: number;
  date: string;
  jobId?: string;
  notes?: string;
  legacy?: true;
}

export interface UnitStockTransaction {
  id?: string;
  transactionId: string;
  skuId: string;
  entity: 'material' | 'product';
  type: 'Opening' | 'Purchase' | 'Start' | 'Adjustment' | 'Sale' | 'Reversal';
  units: number;
  unitCost: number;
  totalValue: number;
  module: AssignedDepartment;
  date: string;
  supplier?: string;
  paymentStatus?: 'Paid' | 'Credit';
  reference?: string;
  notes?: string;
  userId: string;
  userName: string;
  adminOverride?: boolean;
  reverses?: string;
  beforeUnits?: number;
  afterUnits?: number;
  /** Compatibility only: new records never populate meter fields. */
  transactionType?: never;
  quantityMeters?: never;
  jobId?: never;
  legacy?: false;
}
export type StockTransaction = LegacyStockTransaction | UnitStockTransaction;
export type UnitStockItem = Omit<StockItem, 'width' | 'totalStockMeters' | 'lastPurchasePricePerRoll_UGX'> & {
  width?: number; unit: StockUnit; unitsOnHand: number; avgCostPerUnit: number;
};
export type CostedInventoryItem = InventoryItem & { purchasePrice: number; avgCost: number };
export type CostedSaleItem = SaleItem & { module: AssignedDepartment; cogsAtSale: number };

export interface PricingTier {
  preset?: 'A4' | 'A3' | null;
  id: string;
  name: string;
  value: number;
  categoryId: string;
}

export interface BankingRecord {
  id: string;
  date: string;
  amount: number;
  userId: string;
  userName?: string;
}

export interface SystemSettings {
  id?: string;
  inventoryMaterialMigrationV1?: boolean;
  inventoryMigrationEnabled?: boolean;
  inventoryMigrationV1?: boolean;
  customerCategories?: string[];
  customerCategoryMigrationV1?: boolean;
  customerCategoryMigrationV2?: boolean;
  customerCategoryMigrationV3?: boolean;
  businessName: string;
  tagline: string;
  businessEmail: string;
  businessPhone: string;
  businessLocation: string;
  receiptHeader: string;
  receiptFooter: string;
  statementHeader: string;
  statementFooter: string;
  predefinedRules?: string[];
}
