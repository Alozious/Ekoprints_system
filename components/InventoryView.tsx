
import React, { useState, useMemo, useEffect } from 'react';
import { MaterialCategory, StockItem, StockTransaction, PricingTier, InventoryItem, ProductCategory } from '../types';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
// Fix: Added InventoryIcon to imports
import { PlusIcon, EditIcon, TrashIcon, AlertTriangleIcon, ArrowUpCircleIcon, ArrowDownCircleIcon, BeakerIcon, InventoryIcon } from './icons';
import { useToast } from '../App';

const ROLL_LENGTH_METERS = 50;

interface InventoryViewProps {
  materialCategories: MaterialCategory[];
  stockItems: StockItem[];
  stockTransactions: StockTransaction[];
  pricingTiers: PricingTier[];
  onStockIn: (skuId: string, rolls: number, price: number, notes: string) => Promise<void>;
  onStockOut: (skuId: string, metersUsed: number, jobId: string, notes: string) => Promise<void>;
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onToggleCategoryStatus: (id: string, currentStatus: boolean) => Promise<void>;
  onDeleteCategory: (category: MaterialCategory) => Promise<void>;
  onAddStockItem: (categoryId: string, width: number, reorderLevel: number, itemName: string) => Promise<void>;
  onUpdateStockItem: (id: string, reorderLevel: number) => Promise<void>;
  onDeleteStockItem: (id: string) => Promise<void>;
  onAddTier: (name: string, value: number, categoryId: string) => Promise<void>;
  onUpdateTier: (id: string, name: string, value: number) => Promise<void>;
  onDeleteTier: (id: string) => Promise<void>;
  inventory: InventoryItem[];
  onAddInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  onUpdateInventoryItem: (id: string, item: Partial<InventoryItem>) => Promise<void>;
  onDeleteInventoryItem: (id: string) => Promise<void>;
  productCategories: ProductCategory[];
  onAddProductCategory: (cat: Omit<ProductCategory, 'id'>) => Promise<void>;
  onUpdateProductCategory: (id: string, cat: Partial<ProductCategory>) => Promise<void>;
  onDeleteProductCategory: (id: string) => Promise<void>;
}

const formatUGX = (amount: number | undefined) => {
  if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
  return new Intl.NumberFormat('en-US').format(amount) + ' UGX';
};

const formatNumberWithCommas = (val: number | string) => {
    if (val === '' || val === undefined || val === null) return '';
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('en-US').format(num);
};

const parseCommaString = (val: string) => {
    if (!val) return 0;
    const cleaned = String(val).replace(/,/g, '');
    return cleaned === '' ? 0 : parseFloat(cleaned);
};

// Fix: Define SetupViewProps used in setup sub-views
interface SetupViewProps extends InventoryViewProps {
  categoryConfig: { id: string, label: string, type: string };
  filteredMaterialCategories: MaterialCategory[];
  filteredStockItems: StockItem[];
  onOpenProductTypeModal: (config: ProductCategory | null) => void;
}

// Fix: Define SetupView component to handle setup sub-routing
const SetupView: React.FC<SetupViewProps> = (props) => {
  const { categoryConfig } = props;
  if (categoryConfig.type === 'stock') {
    return <GeneralSetupView {...props} />;
  }
  if (categoryConfig.type === 'mixed') {
    return (
      <div className="space-y-8">
        <GeneralSetupView {...props} />
        <PricingSetupView {...props} />
      </div>
    );
  }
  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Product Categories</h3>
        <button onClick={() => props.onOpenProductTypeModal(null)} className="bg-yellow-400 text-[#1A2232] px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-yellow-500 active:scale-95 transition-all flex items-center">
          <PlusIcon className="w-4 h-4 mr-2"/> Add Category
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {props.productCategories.map(cat => (
          <div key={cat.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-blue-200 transition-all">
            <span className="font-black text-[11px] text-gray-900 uppercase tracking-tight">{cat.name}</span>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => props.onOpenProductTypeModal(cat)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><EditIcon className="w-4 h-4"/></button>
              <button onClick={() => props.onDeleteProductCategory(cat.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><TrashIcon className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Fix: Define ConfigModalContent component for ProductCategory configuration
const ConfigModalContent: React.FC<{ initialData: ProductCategory | null, onSave: (data: Partial<ProductCategory>) => Promise<void> }> = ({ initialData, onSave }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [field1, setField1] = useState(initialData?.field1 || '');
  const [field2, setField2] = useState(initialData?.field2 || '');
  const [field3, setField3] = useState(initialData?.field3 || '');

  const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";
  const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";

  return (
    <form onSubmit={e => { e.preventDefault(); onSave({ name, field1, field2, field3 }); }} className="space-y-6">
      <div>
        <label className={labelStyle}>Category Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className={darkInput} required />
      </div>
      <div>
        <label className={labelStyle}>Attribute 1 Label</label>
        <input type="text" value={field1} onChange={e => setField1(e.target.value)} className={darkInput} placeholder="e.g. Size" />
      </div>
      <div>
        <label className={labelStyle}>Attribute 2 Label</label>
        <input type="text" value={field2} onChange={e => setField2(e.target.value)} className={darkInput} placeholder="e.g. Color" />
      </div>
      <div>
        <label className={labelStyle}>Attribute 3 Label</label>
        <input type="text" value={field3} onChange={e => setField3(e.target.value)} className={darkInput} placeholder="e.g. Material" />
      </div>
      <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Save Config</button>
    </form>
  );
};

// Fix: Define ProductModal component for individual inventory item management
const ProductModal: React.FC<{
  isOpen: boolean; onClose: () => void; product: InventoryItem | null; productCategories: ProductCategory[];
  categoryDefault?: string;
  onSave: (data: Partial<InventoryItem>) => Promise<void>;
}> = ({ isOpen, onClose, product, productCategories, categoryDefault, onSave }) => {
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '', category: categoryDefault || '', quantity: 0, price: 0, minPrice: 0, minStockLevel: 5, attr1: '', attr2: '', attr3: ''
  });

  useEffect(() => {
    if (product) setFormData(product);
    else setFormData({ name: '', category: categoryDefault || '', quantity: 0, price: 0, minPrice: 0, minStockLevel: 5, attr1: '', attr2: '', attr3: '' });
  }, [product, isOpen, categoryDefault]);

  const activeCat = productCategories.find(c => c.name === formData.category);
  const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";
  const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={product ? "Update Inventory" : "New Inventory Item"}>
      <form onSubmit={e => { e.preventDefault(); onSave(formData); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelStyle}>Item Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={darkInput} required />
          </div>
          <div className="col-span-2">
            <label className={labelStyle}>Category</label>
            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={darkInput} required>
              <option value="">Select Category...</option>
              {productCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              <option value="Supplies">Supplies</option>
            </select>
          </div>
          {activeCat?.field1 && (
            <div>
              <label className={labelStyle}>{activeCat.field1}</label>
              <input type="text" value={formData.attr1 || ''} onChange={e => setFormData({...formData, attr1: e.target.value})} className={darkInput} />
            </div>
          )}
          {activeCat?.field2 && (
            <div>
              <label className={labelStyle}>{activeCat.field2}</label>
              <input type="text" value={formData.attr2 || ''} onChange={e => setFormData({...formData, attr2: e.target.value})} className={darkInput} />
            </div>
          )}
          <div>
            <label className={labelStyle}>Quantity</label>
            <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} className={darkInput} required />
          </div>
          <div>
            <label className={labelStyle}>Min Stock Level</label>
            <input type="number" value={formData.minStockLevel} onChange={e => setFormData({...formData, minStockLevel: parseInt(e.target.value)})} className={darkInput} required />
          </div>
          <div>
            <label className={labelStyle}>Selling Price</label>
            <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value)})} className={`${darkInput} text-yellow-400`} required />
          </div>
          <div>
            <label className={labelStyle}>Min Price</label>
            <input type="number" value={formData.minPrice} onChange={e => setFormData({...formData, minPrice: parseInt(e.target.value)})} className={`${darkInput} text-rose-400`} required />
          </div>
        </div>
        <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all mt-4">Save Entry</button>
      </form>
    </Modal>
  );
};

const InventoryView: React.FC<InventoryViewProps> = (props) => {
  const [activeCategoryTab, setActiveCategoryTab] = useState('large-format');
  const [activeSubTab, setActiveSubTab] = useState('dashboard');
  
  const [isProductTypeModalOpen, setIsProductTypeModalOpen] = useState(false);
  const [editingProductType, setEditingProductType] = useState<ProductCategory | null>(null);

  const INVENTORY_TABS = [
      { id: 'large-format', label: 'Large Format', type: 'stock' },
      { id: 'dtf', label: 'DTF', type: 'mixed' },
      { id: 'embroidery', label: 'Embroidery', type: 'product' },
      { id: 'bizhub', label: 'Bizhub', type: 'product' },
      { id: 'supplies', label: 'Supplies', type: 'product' },
      { id: 'products', label: 'Products', type: 'product' },
  ];

  const activeCategoryConfig = INVENTORY_TABS.find(t => t.id === activeCategoryTab) || INVENTORY_TABS[0];

  const filteredMaterialCategories = useMemo(() => {
      if (activeCategoryConfig.type === 'product') return [];
      return props.materialCategories.filter(cat => {
          const isDTF = ['dtf', 'direct to film'].some(match => cat.name.toLowerCase().includes(match));
          if (activeCategoryTab === 'dtf') return isDTF;
          if (activeCategoryTab === 'large-format') return !isDTF;
          return false;
      });
  }, [props.materialCategories, activeCategoryTab, activeCategoryConfig]);

  const filteredStockItems = useMemo(() => {
      if (activeCategoryConfig.type === 'product') return [];
      const validCategoryIds = new Set(filteredMaterialCategories.map(c => c.id));
      let items = props.stockItems.filter(item => validCategoryIds.has(item.categoryId));
      if (activeCategoryTab === 'dtf') {
        items = items.filter(item => item.itemName.toLowerCase().includes('film') || item.itemName.toLowerCase().includes('roll'));
      }
      return items;
  }, [props.stockItems, filteredMaterialCategories, activeCategoryConfig, activeCategoryTab]);

  const filteredInventory = useMemo(() => {
      if (activeCategoryConfig.type === 'stock') return [];
      return props.inventory.filter(item => {
          const itemCat = item.category ? item.category.toLowerCase() : '';
          const itemName = item.name ? item.name.toLowerCase() : '';
          if (activeCategoryTab === 'supplies') {
              return item.isConsumable === true || ['ink', 'powder', 'solution', 'clean', 'thread', 'toner'].some(m => itemCat.includes(m) || itemName.includes(m));
          }
          if (activeCategoryTab === 'products') {
              return item.isConsumable === false || !['ink', 'powder', 'solution', 'clean', 'thread', 'toner'].some(m => itemCat.includes(m) || itemName.includes(m));
          }
          if (activeCategoryTab === 'dtf') {
              return ['ink', 'powder', 'clean', 'solution'].some(match => itemCat.includes(match) || itemName.includes(match));
          }
          const matchKeywords: Record<string, string[]> = {
              'embroidery': ['embroidery', 't-shirt', 'shirt', 'polo', 'cap', 'uniform', 'garment'],
              'bizhub': ['bizhub', 'general', 'print', 'card', 'flyer', 'poster', 'book', 'document'],
          };
          const keywords = matchKeywords[activeCategoryTab] || [];
          return keywords.some(match => itemCat.includes(match) || itemName.includes(match));
      });
  }, [props.inventory, activeCategoryTab, activeCategoryConfig]);

  const activeCategoryClass = "px-6 py-4 text-[11px] font-black text-yellow-900 bg-yellow-400/10 border-b-4 border-yellow-500 transition-all uppercase tracking-widest";
  const inactiveCategoryClass = "px-6 py-4 text-[11px] font-bold text-gray-500 hover:text-gray-700 border-b-4 border-transparent transition-all uppercase tracking-widest";
  const activeSubTabClass = "px-5 py-2 text-[10px] font-black text-white bg-[#1A2232] rounded-lg shadow-md transition-all uppercase tracking-wider";
  const inactiveSubTabClass = "px-5 py-2 text-[10px] font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition-all uppercase tracking-wider";

  return (
    <div className="space-y-8">
      {/* Top Category Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 no-scrollbar">
          {INVENTORY_TABS.map(tab => (
              <button 
                key={tab.id} 
                onClick={() => { setActiveCategoryTab(tab.id); setActiveSubTab('dashboard'); }} 
                className={activeCategoryTab === tab.id ? activeCategoryClass : inactiveCategoryClass}
              >
                {tab.label}
              </button>
          ))}
      </div>

      {/* Sub-Tabs Pills */}
      <div className="flex items-center space-x-1 bg-gray-200/50 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveSubTab('dashboard')} className={activeSubTab === 'dashboard' ? activeSubTabClass : inactiveSubTabClass}>Dashboard</button>
          <button onClick={() => setActiveSubTab('setup')} className={activeSubTab === 'setup' ? activeSubTabClass : inactiveSubTabClass}>Setup</button>
          <button onClick={() => setActiveSubTab('reports')} className={activeSubTab === 'reports' ? activeSubTabClass : inactiveSubTabClass}>Reports</button>
      </div>

      <div className="min-h-[500px]">
        {activeSubTab === 'dashboard' && (
            <InventoryDashboardView {...props} categoryConfig={activeCategoryConfig} filteredStockItems={filteredStockItems} filteredInventory={filteredInventory} />
        )}
        {activeSubTab === 'setup' && (
            <SetupView 
                {...props} 
                categoryConfig={activeCategoryConfig} 
                filteredMaterialCategories={filteredMaterialCategories} 
                filteredStockItems={filteredStockItems}
                onOpenProductTypeModal={(config) => {
                    setEditingProductType(config);
                    setIsProductTypeModalOpen(true);
                }}
            />
        )}
        {activeSubTab === 'reports' && (
            <InventoryReportsView {...props} categoryConfig={activeCategoryConfig} filteredStockItems={filteredStockItems} filteredInventory={filteredInventory} />
        )}
      </div>

      <Modal isOpen={isProductTypeModalOpen} onClose={() => setIsProductTypeModalOpen(false)} title={editingProductType ? "Modify Product Configuration" : "Establish New Product Type"}>
          <ConfigModalContent 
              initialData={editingProductType} 
              onSave={async (data) => {
                  if (editingProductType) await props.onUpdateProductCategory(editingProductType.id, data);
                  else await props.onAddProductCategory(data as any);
                  setIsProductTypeModalOpen(false);
              }}
          />
      </Modal>
    </div>
  );
};

// --- DASHBOARD VIEW ---
interface InventoryDashboardViewProps extends InventoryViewProps {
    categoryConfig: { id: string, label: string, type: string };
    filteredStockItems: StockItem[];
    filteredInventory: InventoryItem[];
}

const InventoryDashboardView: React.FC<InventoryDashboardViewProps> = ({ 
    categoryConfig, filteredStockItems, filteredInventory, productCategories,
    onStockIn, onStockOut, onAddInventoryItem, onUpdateInventoryItem, onDeleteInventoryItem 
}) => {
    const [isStockInOpen, setIsStockInOpen] = useState(false);
    const [isStockOutOpen, setIsStockOutOpen] = useState(false);
    const { addToast } = useToast();
    
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<InventoryItem | null>(null);

    const lowStockAlerts = useMemo(() => {
        const alerts: (StockItem | InventoryItem)[] = [];
        if (categoryConfig.type === 'stock' || categoryConfig.type === 'mixed') alerts.push(...filteredStockItems.filter(item => (item.totalStockMeters || 0) <= item.reorderLevel));
        if (categoryConfig.type === 'product' || categoryConfig.type === 'mixed') alerts.push(...filteredInventory.filter(item => item.quantity <= (item.minStockLevel || 5)));
        return alerts;
    }, [filteredStockItems, filteredInventory, categoryConfig]);

    const confirmDeleteProduct = async () => {
        if (productToDelete) {
            await onDeleteInventoryItem(productToDelete.id);
            setProductToDelete(null);
        }
    };
    
    const handleLogUsage = async (item: InventoryItem) => {
        if (item.quantity <= 0) {
            addToast(`Cannot log usage. "${item.name}" is out of stock.`, "error");
            return;
        }
        await onUpdateInventoryItem(item.id, { quantity: item.quantity - 1 });
        addToast(`Usage logged for "${item.name}".`, "success");
    };

    const showStockSection = categoryConfig.type === 'stock' || categoryConfig.type === 'mixed';
    const showProductSection = categoryConfig.type === 'product' || categoryConfig.type === 'mixed';

    return (
        <div className="fade-in space-y-10">
             {lowStockAlerts.length > 0 && (
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border-l-4 border-yellow-400">
                    <h3 className="text-sm font-black text-yellow-600 uppercase tracking-widest mb-6 flex items-center">
                        <AlertTriangleIcon className="w-5 h-5 mr-3" /> Low Stock Alerts
                    </h3>
                    <div className="space-y-1">
                        {lowStockAlerts.map((item: any) => (
                            <div key={item.skuId || item.id} className="flex justify-between items-center p-3 rounded-xl bg-yellow-400/5 hover:bg-yellow-400/10 transition-colors">
                                <span className="text-[11px] font-black text-yellow-800 uppercase tracking-tight">{item.itemName || item.name}</span>
                                <span className="text-[10px] font-black text-yellow-600 uppercase">
                                    {item.skuId ? `In Stock: ${(item.totalStockMeters || 0).toFixed(1)}m` : `In Stock: ${item.quantity}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showStockSection && (
                <div>
                    <div className="flex justify-between items-center mb-6 px-1">
                        <h3 className="text-[13px] font-black text-gray-800 uppercase tracking-widest">Stock (Rolls/Meters)</h3>
                        <div className="flex gap-2">
                             <button onClick={() => setIsStockInOpen(true)} className="bg-emerald-600 text-white px-5 py-2 rounded-xl hover:bg-emerald-700 text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Stock-In</button>
                             <button onClick={() => setIsStockOutOpen(true)} className="bg-rose-600 text-white px-5 py-2 rounded-xl hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Stock-Out</button>
                        </div>
                    </div>
                    <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50">
                                <tr>
                                    <th className="px-8 py-5">Item Name</th>
                                    <th className="px-8 py-5 text-center">Width</th>
                                    <th className="px-8 py-5 text-center">Stock</th>
                                    <th className="px-8 py-5 text-center">Min</th>
                                    <th className="px-8 py-5 text-right">Price/Roll</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredStockItems.map(item => (
                                    <tr key={item.skuId} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-8 py-5 font-black text-gray-900 uppercase tracking-tight">{item.itemName}</td>
                                        <td className="px-8 py-5 text-center font-bold text-gray-500">{item.width}m</td>
                                        <td className="px-8 py-5 text-center font-black text-gray-800">{(item.totalStockMeters || 0).toFixed(1)}m</td>
                                        <td className="px-8 py-5 text-center font-bold text-gray-400">{item.reorderLevel}m</td>
                                        <td className="px-8 py-5 text-right font-black text-gray-900">{formatUGX(item.lastPurchasePricePerRoll_UGX)}</td>
                                    </tr>
                                ))}
                                {filteredStockItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-xs">Zero material volume detected</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

             {showProductSection && (
                <div>
                    <div className="flex justify-between items-center mb-6 px-1">
                        <h3 className="text-[13px] font-black text-gray-800 uppercase tracking-widest">Inventory Management</h3>
                        <button onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95">Add Item</button>
                    </div>
                    <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/50">
                                <tr>
                                    <th className="px-8 py-5">Item Name</th>
                                    <th className="px-8 py-5">Specification</th>
                                    <th className="px-8 py-5 text-center">Qty</th>
                                    <th className="px-8 py-5 text-center">Min</th>
                                    <th className="px-8 py-5 text-right">Unit Price</th>
                                    <th className="px-8 py-5 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredInventory.map(item => {
                                    const config = productCategories.find(c => c.name === item.category);
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-8 py-5 font-black text-gray-900 uppercase tracking-tight">{item.name}</td>
                                            <td className="px-8 py-5">
                                                {config ? (
                                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 max-w-xs text-[10px] font-bold text-gray-500 uppercase">
                                                        {config.field1 && item.attr1 && <span>{config.field1}: {item.attr1}</span>}
                                                        {config.field2 && item.attr2 && <span>{config.field2}: {item.attr2}</span>}
                                                        {config.field3 && item.attr3 && <span>{config.field3}: {item.attr3}</span>}
                                                    </div>
                                                ) : <span className="text-[10px] text-gray-400 italic">Uncategorized</span>}
                                            </td>
                                            <td className="px-8 py-5 text-center font-black text-gray-800">{item.quantity}</td>
                                            <td className="px-8 py-5 text-center font-bold text-gray-400">{item.minStockLevel}</td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-black text-gray-900">{formatUGX(item.price)}</span>
                                                    <span className="text-[8px] text-rose-500 font-black uppercase tracking-tighter mt-0.5">Min: {formatUGX(item.minPrice).replace(' UGX', '')}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <div className="flex justify-center items-center space-x-2">
                                                    <button onClick={() => handleLogUsage(item)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-all hover:scale-110" title="Log Usage"><BeakerIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all hover:scale-110" title="Edit Record"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => { setProductToDelete(item); setIsConfirmDeleteOpen(true); }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all hover:scale-110" title="Delete Entry"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredInventory.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center text-gray-300 font-black uppercase tracking-[0.4em] text-xs">Void warehouse inventory</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
             )}
            
            <StockInModal isOpen={isStockInOpen} onClose={() => setIsStockInOpen(false)} stockItems={filteredStockItems} onStockIn={onStockIn} />
            <StockOutModal isOpen={isStockOutOpen} onClose={() => setIsStockOutOpen(false)} stockItems={filteredStockItems} onStockOut={onStockOut} />
            <ProductModal 
                isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} product={editingProduct} productCategories={productCategories}
                categoryDefault={categoryConfig.id === 'supplies' ? 'Supplies' : ''}
                onSave={async (data) => {
                    if (editingProduct) await onUpdateInventoryItem(editingProduct.id, data);
                    else await onAddInventoryItem(data as any);
                    setIsProductModalOpen(false);
                }}
            />
            <ConfirmationModal isOpen={isConfirmDeleteOpen} onClose={() => setIsConfirmDeleteOpen(false)} onConfirm={confirmDeleteProduct} title="Purge Record" message={`Authorize permanent removal of this item from the warehouse directory?`} />
        </div>
    );
};

const GeneralSetupView: React.FC<SetupViewProps> = ({ 
    materialCategories, onAddCategory, onUpdateCategory, onDeleteCategory,
    stockItems, onAddStockItem, onUpdateStockItem, onDeleteStockItem 
}) => {
    const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
    const [catName, setCatName] = useState('');
    const [isAddSkuModalOpen, setIsAddSkuModalOpen] = useState(false);
    const [selectedCatId, setSelectedCatId] = useState('');
    const [skuName, setSkuName] = useState('');
    const [width, setWidth] = useState(0);
    const [reorder, setReorder] = useState(50);

    const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";
    const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";

    return (
        <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Material Categories</h3>
                    <button onClick={() => setIsAddCatModalOpen(true)} className="bg-yellow-400 text-[#1A2232] px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-yellow-500 active:scale-95 transition-all flex items-center">
                        <PlusIcon className="w-4 h-4 mr-2"/> Add Category
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {materialCategories.map(cat => (
                        <div key={cat.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-blue-200 transition-all">
                            <span className="font-black text-[11px] text-gray-900 uppercase tracking-tight">{cat.name}</span>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { const n = prompt('New name:', cat.name); if(n) onUpdateCategory(cat.id, n); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><EditIcon className="w-4 h-4"/></button>
                                <button onClick={() => onDeleteCategory(cat)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                    {materialCategories.length === 0 && <p className="col-span-full text-center py-6 text-gray-300 font-bold italic text-xs">No categories established</p>}
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Inventory SKUs (Dimensions)</h3>
                    <button onClick={() => setIsAddSkuModalOpen(true)} className="bg-yellow-400 text-[#1A2232] px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-yellow-500 active:scale-95 transition-all flex items-center">
                        <PlusIcon className="w-4 h-4 mr-2"/> Define SKU
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50/50 text-[10px] uppercase font-black text-gray-400 tracking-widest">
                            <tr>
                                <th className="px-6 py-4">Item Name</th>
                                <th className="px-6 py-4 text-center">Category</th>
                                <th className="px-6 py-4 text-center">Width</th>
                                <th className="px-6 py-4 text-center">Reorder Level</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {stockItems.map(item => (
                                <tr key={item.skuId} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 font-black text-gray-900 uppercase tracking-tight">{item.itemName}</td>
                                    <td className="px-6 py-4 text-center font-bold text-gray-500 text-[10px] uppercase">{materialCategories.find(c => c.id === item.categoryId)?.name || '-'}</td>
                                    <td className="px-6 py-4 text-center font-black text-gray-600">{item.width}m</td>
                                    <td className="px-6 py-4 text-center font-bold text-gray-400">{item.reorderLevel}m</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => { const r = prompt('New reorder level:', String(item.reorderLevel)); if(r) onUpdateStockItem(item.skuId, parseInt(r)); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><EditIcon className="w-4 h-4"/></button>
                                            <button onClick={() => onDeleteStockItem(item.skuId)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isAddCatModalOpen} onClose={() => setIsAddCatModalOpen(false)} title="New Category Entry">
                <form onSubmit={e => { e.preventDefault(); onAddCategory(catName); setIsAddCatModalOpen(false); setCatName(''); }} className="space-y-6">
                    <div>
                        <label className={labelStyle}>Material Specification Label</label>
                        <input type="text" value={catName} onChange={e => setCatName(e.target.value)} className={darkInput} placeholder="e.g. Premium Banner" required />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Authorize Registry</button>
                </form>
            </Modal>

            <Modal isOpen={isAddSkuModalOpen} onClose={() => setIsAddSkuModalOpen(false)} title="Establish New Stock Record">
                <form onSubmit={e => { e.preventDefault(); onAddStockItem(selectedCatId, width, reorder, skuName); setIsAddSkuModalOpen(false); }} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className={labelStyle}>Material Classification</label>
                            <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className={darkInput} required>
                                <option value="" className="bg-gray-800">Assign Category...</option>
                                {materialCategories.map(c => <option key={c.id} value={c.id} className="bg-gray-800">{c.name}</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className={labelStyle}>Record Designation (SKU Name)</label>
                            <input type="text" value={skuName} onChange={e => setSkuName(e.target.value)} className={darkInput} placeholder="e.g. 107 Matt Vinyl" required />
                        </div>
                        <div>
                            <label className={labelStyle}>Roll Width (m)</label>
                            <input type="number" step="0.01" value={width} onChange={e => setWidth(parseFloat(e.target.value))} className={darkInput} required />
                        </div>
                        <div>
                            <label className={labelStyle}>Replenishment Threshold (m)</label>
                            <input type="number" value={reorder} onChange={e => setReorder(parseInt(e.target.value))} className={darkInput} required />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all mt-4">Commit Inventory Logic</button>
                </form>
            </Modal>
        </div>
    );
};

// --- Pricing Setup (Re-styled for high contrast) ---
const PricingSetupView: React.FC<SetupViewProps> = ({ materialCategories, pricingTiers, onAddTier, onUpdateTier, onDeleteTier }) => {
    const [isAddTierModalOpen, setIsAddTierModalOpen] = useState(false);
    const [selectedCatId, setSelectedCatId] = useState('');
    const [tierName, setTierName] = useState('');
    const [value, setValue] = useState(0);

    const groupedTiers = useMemo(() => {
        const groups: Record<string, PricingTier[]> = {};
        pricingTiers.forEach(tier => {
            const catId = tier.categoryId || 'uncategorized';
            if (!groups[catId]) groups[catId] = [];
            groups[catId].push(tier);
        });
        const sortedGroups: { id: string, name: string, tiers: PricingTier[] }[] = [];
        materialCategories.forEach(cat => {
            if (groups[cat.id]) {
                sortedGroups.push({ id: cat.id, name: cat.name, tiers: groups[cat.id] });
                delete groups[cat.id];
            }
        });
        if (groups['uncategorized']) sortedGroups.push({ id: 'uncategorized', name: 'Uncategorized', tiers: groups['uncategorized'] });
        return sortedGroups;
    }, [pricingTiers, materialCategories]);

    const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";
    const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";

    return (
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
            <div className="flex justify-between items-center mb-10">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Rate Card Architecture (UGX/cm²)</h3>
                <button onClick={() => setIsAddTierModalOpen(true)} className="bg-yellow-400 text-[#1A2232] px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500 active:scale-95 transition-all shadow-md flex items-center">
                    <PlusIcon className="w-4 h-4 mr-2"/> Define Rate
                </button>
            </div>
            
            <div className="space-y-12">
                {groupedTiers.map(group => (
                    <div key={group.id} className="space-y-4">
                        <div className="flex items-center gap-4">
                            <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.3em] whitespace-nowrap">{group.name}</h4>
                            <div className="h-[2px] flex-1 bg-blue-50"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {group.tiers.map(tier => (
                                <div key={tier.id} className="bg-gray-50 p-6 rounded-[1.8rem] border border-gray-100 group hover:border-yellow-400 hover:shadow-lg transition-all relative overflow-hidden">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Tier Designation</p>
                                    <h5 className="text-xl font-black text-gray-900 tracking-tight mb-4 uppercase">{tier.name}</h5>
                                    
                                    <div className="bg-white p-4 rounded-2xl shadow-inner border border-gray-100">
                                        <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Valuation Multiplier</p>
                                        <p className="text-2xl font-black text-[#1A2232] font-mono tracking-tighter">{(tier.value || 0).toFixed(4)} <span className="text-[10px] text-gray-400">UGX/cm²</span></p>
                                    </div>

                                    <div className="mt-5 flex gap-2">
                                        <button onClick={() => { const v = prompt('New multiplier:', String(tier.value)); if(v) onUpdateTier(tier.id, tier.name, parseFloat(v)); }} className="flex-1 py-2 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-100 transition-all">Edit Rate</button>
                                        <button onClick={() => onDeleteTier(tier.id)} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {groupedTiers.length === 0 && <div className="text-center py-20 text-gray-300 font-black uppercase tracking-[0.4em] text-xs">Void financial schema</div>}
            </div>

            <Modal isOpen={isAddTierModalOpen} onClose={() => setIsAddTierModalOpen(false)} title="Register Valuation Tier">
                <form onSubmit={e => { e.preventDefault(); onAddTier(tierName, value, selectedCatId); setIsAddTierModalOpen(false); }} className="space-y-6">
                    <div>
                        <label className={labelStyle}>Material Mapping</label>
                        <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className={darkInput} required>
                            <option value="" className="bg-gray-800">Select Classification...</option>
                            {materialCategories.map(c => <option key={c.id} value={c.id} className="bg-gray-800">{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelStyle}>Tier Branding</label>
                        <input type="text" value={tierName} onChange={e => setTierName(e.target.value)} className={darkInput} placeholder="e.g. Standard Retail" required />
                    </div>
                    <div>
                        <label className={labelStyle}>Rate Multiplier (UGX per CM²)</label>
                        <input type="number" step="0.0001" value={value} onChange={e => setValue(parseFloat(e.target.value))} className={`${darkInput} text-xl text-yellow-400 font-mono`} placeholder="0.0000" required />
                    </div>
                    <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl active:scale-95 transition-all mt-4 border border-yellow-400/20">Commit Pricing Node</button>
                </form>
            </Modal>
        </div>
    );
};

const InventoryReportsView: React.FC<InventoryDashboardViewProps> = ({ filteredStockItems, filteredInventory }) => {
    const totalStockValue = filteredStockItems.reduce((acc, item) => acc + ((item.totalStockMeters || 0) / ROLL_LENGTH_METERS) * item.lastPurchasePricePerRoll_UGX, 0);
    const totalInventoryValue = filteredInventory.reduce((acc, item) => acc + item.quantity * item.price, 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border-l-8 border-blue-500 relative overflow-hidden group">
                <div className="relative z-10">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Estimated Raw Material Value</h3>
                    <p className="text-4xl font-black text-[#1A2232] tracking-tighter">{formatUGX(totalStockValue)}</p>
                    <p className="mt-4 text-[9px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full w-fit">Valued at Current Roll Replenishment Costs</p>
                </div>
                <InventoryIcon className="absolute right-0 bottom-0 w-32 h-32 text-blue-500 opacity-5 -mr-6 -mb-6" />
            </div>
            
            <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border-l-8 border-emerald-500 relative overflow-hidden group">
                <div className="relative z-10">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Warehouse Product Asset Value</h3>
                    <p className="text-4xl font-black text-[#1A2232] tracking-tighter">{formatUGX(totalInventoryValue)}</p>
                    <p className="mt-4 text-[9px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full w-fit">Aggregate Preferred Market Selling Price</p>
                </div>
                <InventoryIcon className="absolute right-0 bottom-0 w-32 h-32 text-emerald-500 opacity-5 -mr-6 -mb-6" />
            </div>
        </div>
    );
};

const StockInModal: React.FC<{
    isOpen: boolean; onClose: () => void; stockItems: StockItem[]; 
    onStockIn: (skuId: string, rolls: number, price: number, notes: string) => Promise<void>;
}> = ({ isOpen, onClose, stockItems, onStockIn }) => {
    const [skuId, setSkuId] = useState('');
    const [rolls, setRolls] = useState(0);
    const [price, setPrice] = useState(0);
    const [notes, setNotes] = useState('');

    const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";
    const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Inventory Acquisition Protocol">
            <form onSubmit={async e => { e.preventDefault(); await onStockIn(skuId, rolls, price, notes); onClose(); }} className="space-y-6">
                <div>
                    <label className={labelStyle}>Resource Selection</label>
                    <select value={skuId} onChange={e => setSkuId(e.target.value)} className={darkInput} required>
                        <option value="" className="bg-gray-800">Identify SKU...</option>
                        {stockItems.map(i => <option key={i.skuId} value={i.skuId} className="bg-gray-800">{i.itemName}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelStyle}>Batch Quantity (Rolls)</label>
                        <input type="number" step="0.5" value={rolls} onChange={e => setRolls(parseFloat(e.target.value))} className={darkInput} required />
                    </div>
                    <div>
                        <label className={labelStyle}>Current Cost / Roll</label>
                        <input type="number" value={price} onChange={e => setPrice(parseInt(e.target.value))} className={`${darkInput} text-yellow-400 font-mono`} placeholder="0" required />
                    </div>
                </div>
                <div>
                    <label className={labelStyle}>Verification Narration</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${darkInput} min-h-[100px] resize-none`} placeholder="Provider details, lot numbers, or arrival condition..."></textarea>
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white py-5 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all mt-2 border border-emerald-500/20">Authorize Stock Replenishment</button>
            </form>
        </Modal>
    );
};

const StockOutModal: React.FC<{
    isOpen: boolean; onClose: () => void; stockItems: StockItem[]; 
    onStockOut: (skuId: string, meters: number, jobId: string, notes: string) => Promise<void>;
}> = ({ isOpen, onClose, stockItems, onStockOut }) => {
    const [skuId, setSkuId] = useState('');
    const [meters, setMeters] = useState(0);
    const [jobId, setJobId] = useState('');
    const [notes, setNotes] = useState('');

    const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5";
    const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Manual Consumption Entry">
            <form onSubmit={async e => { e.preventDefault(); await onStockOut(skuId, meters, jobId, notes); onClose(); }} className="space-y-6">
                <div>
                    <label className={labelStyle}>Source Roll Identification</label>
                    <select value={skuId} onChange={e => setSkuId(e.target.value)} className={darkInput} required>
                        <option value="" className="bg-gray-800">Identify Material...</option>
                        {stockItems.map(i => <option key={i.skuId} value={i.skuId} className="bg-gray-800">{i.itemName} ({(i.totalStockMeters || 0).toFixed(1)}m available)</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelStyle}>Yield Consumption (m)</label>
                        <input type="number" step="0.1" value={meters} onChange={e => setMeters(parseFloat(e.target.value))} className={darkInput} required />
                    </div>
                    <div>
                        <label className={labelStyle}>Project/Job Reference</label>
                        <input type="text" value={jobId} onChange={e => setJobId(e.target.value)} className={darkInput} placeholder="INV-00000" required />
                    </div>
                </div>
                <div>
                    <label className={labelStyle}>Calibration Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} className={`${darkInput} min-h-[100px] resize-none`} placeholder="Reason for manual adjustment..."></textarea>
                </div>
                <button type="submit" className="w-full bg-rose-600 text-white py-5 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 transition-all mt-2 border border-rose-500/20">Authorize Material Deduction</button>
            </form>
        </Modal>
    );
};

export default InventoryView;
