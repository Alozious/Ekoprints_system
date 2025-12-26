export interface ProductCategory {
  id: string;
  name: string; // e.g. "Tshirt"
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
  id: string;
  name: string;
  category: string; // Links to ProductCategory name
  quantity: number;
  price: number; // Selling Price (Preferred)
  minPrice: number; // Minimum negotiated price allowed
  purchasePrice?: number; // Cost Price for profit tracking
  sku: string;
  minStockLevel: number;
  isConsumable?: boolean; // True for machine supplies, False for products for sale
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
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Customer {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
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
  id: string;
  date: string;
  items: SaleItem[];
  customerId: string;
  total: number;
  amountPaid?: number;
  status: 'Paid' | 'Unpaid' | 'Pending' | 'Partially Paid';
  userId: string;
  userName?: string;
  payments?: Payment[];
  usageLogged?: boolean;
}

export interface Expense {
  id:string;
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
  id: string;
  name: string;
  isActive: boolean;
}

export interface StockItem {
  skuId: string;
  categoryId: string;
  width: number; // in meters
  itemName: string;
  totalStockMeters: number;
  reorderLevel: number;
  lastPurchasePricePerRoll_UGX: number;
}

export interface StockTransaction {
  transactionId: string;
  skuId: string;
  transactionType: 'Stock-In' | 'Stock-Out';
  quantityMeters: number;
  date: string;
  jobId?: string;
  notes?: string;
}

export interface PricingTier {
  id: string;
  name: string;
  value: number;
  categoryId: string;
}