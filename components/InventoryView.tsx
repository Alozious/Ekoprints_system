
import React, { useState, useMemo, useEffect } from 'react';
import { MaterialCategory, StockItem, StockTransaction, PricingTier, InventoryItem, ProductCategory } from '../types';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import { PlusIcon, EditIcon, TrashIcon, AlertTriangleIcon, ArrowUpCircleIcon, ArrowDownCircleIcon, BeakerIcon } from './icons';
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

const InventoryView: React.FC<InventoryViewProps> = (props) => {
  const [activeCategoryTab, setActiveCategoryTab] = useState('large-format');
  const [activeSubTab, setActiveSubTab] = useState('dashboard');
  
  // State lifted for Modal handling at root level of InventoryView
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

  const activeCategoryClass = "px-4 py-3 text-sm font-bold text-yellow-800 bg-yellow-100 border-b-4 border-yellow-500 rounded-t-md shadow-sm";
  const inactiveCategoryClass = "px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-200 border-b-4 border-transparent transition-colors";
  const activeSubTabClass = "px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-md shadow";
  const inactiveSubTabClass = "px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-md transition-colors";

  return (
    <div className="space-y-6">
      <div className="flex overflow-x-auto border-b border-gray-200 no-scrollbar space-x-1">
          {INVENTORY_TABS.map(tab => (
              <button key={tab.id} onClick={() => { setActiveCategoryTab(tab.id); setActiveSubTab('dashboard'); }} className={activeCategoryTab === tab.id ? activeCategoryClass : inactiveCategoryClass}>{tab.label}</button>
          ))}
      </div>
      <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg w-fit">
          <button onClick={() => setActiveSubTab('dashboard')} className={activeSubTab === 'dashboard' ? activeSubTabClass : inactiveSubTabClass}>Dashboard</button>
          <button onClick={() => setActiveSubTab('setup')} className={activeSubTab === 'setup' ? activeSubTabClass : inactiveSubTabClass}>Setup</button>
          <button onClick={() => setActiveSubTab('reports')} className={activeSubTab === 'reports' ? activeSubTabClass : inactiveSubTabClass}>Reports</button>
      </div>
      <div className="min-h-[600px] relative">
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
        <div className="fade-in space-y-8">
             {lowStockAlerts.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-400">
                    <h3 className="text-lg font-semibold text-yellow-600 mb-4 flex items-center"><AlertTriangleIcon className="w-6 h-6 mr-2" /> Low Stock Alerts</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {lowStockAlerts.map((item: any) => (
                            <div key={item.skuId || item.id} className="flex justify-between items-center p-2 rounded-md bg-yellow-50">
                                <span className="font-medium text-yellow-800">{item.itemName || item.name}</span>
                                <span className="text-sm text-yellow-600">{item.skuId ? `In Stock: ${(item.totalStockMeters || 0).toFixed(1)}m` : `Qty: ${item.quantity}`}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showStockSection && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-md font-semibold text-gray-600">Stock (Rolls/Meters)</h3>
                        <div className="flex gap-3">
                             <button onClick={() => setIsStockInOpen(true)} className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 text-sm font-bold shadow-sm">Stock-In</button>
                             <button onClick={() => setIsStockOutOpen(true)} className="bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 text-sm font-bold shadow-sm">Stock-Out</button>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto border border-gray-100">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3">Item Name</th>
                                    <th className="px-6 py-3">Width</th>
                                    <th className="px-6 py-3">Stock</th>
                                    <th className="px-6 py-3">Min</th>
                                    <th className="px-6 py-3 text-right">Price/Roll</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStockItems.map(item => (
                                    <tr key={item.skuId} className="border-b border-gray-50 hover:bg-gray-50 bg-white">
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.itemName}</td>
                                        <td className="px-6 py-4">{item.width}m</td>
                                        <td className="px-6 py-4 font-bold">{(item.totalStockMeters || 0).toFixed(1)}m</td>
                                        <td className="px-6 py-4">{item.reorderLevel}m</td>
                                        <td className="px-6 py-4 text-right">{formatUGX(item.lastPurchasePricePerRoll_UGX)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

             {showProductSection && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-md font-semibold text-gray-600">Inventory Items</h3>
                        <button onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-bold shadow-md active:scale-95 transition-transform">Add Item</button>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden overflow-x-auto border border-gray-100">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3">Item Name</th>
                                    <th className="px-6 py-3">Details</th>
                                    <th className="px-6 py-3 text-center">Qty</th>
                                    <th className="px-6 py-3 text-center">Min</th>
                                    <th className="px-6 py-3 text-right">Price Range</th>
                                    <th className="px-6 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInventory.map(item => {
                                    const config = productCategories.find(c => c.name === item.category);
                                    return (
                                        <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 bg-white">
                                            <td className="px-6 py-4 font-bold text-gray-900">{item.name}</td>
                                            <td className="px-6 py-4 text-[10px]">
                                                {config ? (
                                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 max-w-xs text-gray-600">
                                                        {config.field1 && item.attr1 && <span><strong>{config.field1}:</strong> {item.attr1} |</span>}
                                                        {config.field2 && item.attr2 && <span><strong>{config.field2}:</strong> {item.attr2} |</span>}
                                                        {config.field3 && item.attr3 && <span><strong>{config.field3}:</strong> {item.attr3} |</span>}
                                                        {config.field4 && item.attr4 && <span><strong>{config.field4}:</strong> {item.attr4} |</span>}
                                                        {config.field5 && item.attr5 && <span><strong>{config.field5}:</strong> {item.attr5}</span>}
                                                    </div>
                                                ) : <span className="text-gray-400 italic">Generic Item</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-gray-800">{item.quantity}</td>
                                            <td className="px-6 py-4 text-center text-gray-400">{item.minStockLevel}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-black text-gray-900">{formatUGX(item.price)}</span>
                                                    <span className="text-[9px] text-red-500 font-bold uppercase">Min: {formatUGX(item.minPrice)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center items-center space-x-2">
                                                    <button onClick={() => handleLogUsage(item)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-full transition-colors" title="Log Usage"><BeakerIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => { setEditingProduct(item); setIsProductModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="Edit"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => { setProductToDelete(item); setIsConfirmDeleteOpen(true); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Delete"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
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
            <ConfirmationModal isOpen={isConfirmDeleteOpen} onClose={() => setIsConfirmDeleteOpen(false)} onConfirm={confirmDeleteProduct} title="Delete Product" message={`Confirm permanent deletion of this item?`} />
        </div>
    );
};

// --- SETUP VIEW ---
interface SetupViewProps extends InventoryViewProps {
    categoryConfig: { id: string, label: string, type: string };
    filteredMaterialCategories: MaterialCategory[];
    filteredStockItems: StockItem[];
    onOpenProductTypeModal: (config: ProductCategory | null) => void;
}

const SetupView: React.FC<SetupViewProps> = (props) => {
    const [setupTab, setSetupTab] = useState('general');
    const { categoryConfig, productCategories, onOpenProductTypeModal, onDeleteProductCategory } = props;

    const activeSubTabClass = "px-4 py-2 text-sm font-medium text-gray-800 bg-white shadow-sm rounded-md border border-gray-200";
    const inactiveSubTabClass = "px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-200 rounded-md transition-colors";

    if (categoryConfig.type === 'product') {
        return (
            <div className="fade-in space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-700">Product Custom Fields Setup</h2>
                    <button onClick={() => onOpenProductTypeModal(null)} className="bg-yellow-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-yellow-600 transition-all flex items-center active:scale-95">
                        <PlusIcon className="w-5 h-5 mr-2" /> Define New Product Type
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {productCategories.map(cat => (
                        <div key={cat.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onOpenProductTypeModal(cat)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg shadow-sm"><EditIcon className="w-4 h-4"/></button>
                                <button onClick={() => onDeleteProductCategory(cat.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg shadow-sm"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                            <div className="flex items-center mb-6">
                                <div className="p-3 bg-yellow-100 rounded-2xl text-yellow-700 mr-4 shadow-inner">
                                    <PlusIcon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-black text-gray-800 tracking-tight">{cat.name}</h3>
                            </div>
                            <div className="space-y-2 border-t border-gray-50 pt-5">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Custom Categorization</p>
                                {[cat.field1, cat.field2, cat.field3, cat.field4, cat.field5].filter(Boolean).map((f, i) => (
                                    <div key={i} className="flex flex-col text-sm font-medium text-gray-600 py-2 border-b border-gray-50 last:border-0">
                                        <div className="flex items-center mb-1">
                                            <div className="w-2 h-2 rounded-full bg-yellow-400 mr-3 shadow-sm"></div>
                                            {f}
                                        </div>
                                        {((cat as any)[`field${i+1}Options`]?.length > 0) && (
                                            <div className="flex flex-wrap gap-1 ml-5">
                                                {(cat as any)[`field${i+1}Options`].map((opt: string, idx: number) => (
                                                    <span key={idx} className="bg-gray-100 text-[9px] px-1.5 py-0.5 rounded border border-gray-200">{opt}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="fade-in space-y-6">
            <h2 className="text-lg font-semibold text-gray-700">{categoryConfig.label} Infrastructure</h2>
            <div className="flex items-center space-x-2 p-1 bg-gray-100 rounded-xl w-fit">
                 <button onClick={() => setSetupTab('general')} className={setupTab === 'general' ? activeSubTabClass : inactiveSubTabClass}>Categories & SKUs</button>
                 <button onClick={() => setSetupTab('pricing')} className={setupTab === 'pricing' ? activeSubTabClass : inactiveSubTabClass}>Pricing Tiers</button>
            </div>
            <div className="pt-2">
                {setupTab === 'general' ? <GeneralSetupView {...props} /> : <PricingSetupView {...props} />}
            </div>
        </div>
    );
}

const ConfigModalContent: React.FC<{ initialData: ProductCategory | null, onSave: (data: any) => void }> = ({ initialData, onSave }) => {
    const [name, setName] = useState(initialData?.name || '');
    
    const [fields, setFields] = useState([
        { label: initialData?.field1 || '', options: (initialData?.field1Options || []).join(', ') },
        { label: initialData?.field2 || '', options: (initialData?.field2Options || []).join(', ') },
        { label: initialData?.field3 || '', options: (initialData?.field3Options || []).join(', ') },
        { label: initialData?.field4 || '', options: (initialData?.field4Options || []).join(', ') },
        { label: initialData?.field5 || '', options: (initialData?.field5Options || []).join(', ') },
    ]);

    const handleFieldChange = (index: number, key: 'label' | 'options', value: string) => {
        const newFields = [...fields];
        newFields[index][key] = value;
        setFields(newFields);
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalData: any = { name };
        fields.forEach((f, i) => {
            const num = i + 1;
            finalData[`field${num}`] = f.label;
            finalData[`field${num}Options`] = f.options ? f.options.split(',').map(s => s.trim()).filter(Boolean) : [];
        });
        onSave(finalData);
    };

    const darkInput = "block w-full rounded-xl border-gray-300 bg-white p-2 text-xs font-bold text-black focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all";
    const optionInput = "block w-full rounded-lg border-gray-300 bg-white p-1.5 text-[10px] italic text-gray-700 focus:border-yellow-400 focus:ring-0 transition-all mt-1";

    return (
        <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="bg-gray-100 p-4 rounded-2xl shadow-inner mb-2 border border-gray-200">
                <label className="block text-[9px] font-black text-yellow-600 uppercase tracking-[0.2em] mb-1.5 ml-1">PRIMARY CATEGORY NAME</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="block w-full rounded-xl border border-gray-300 bg-white p-3 text-sm font-black text-black placeholder-gray-500 focus:ring-2 focus:ring-yellow-500" placeholder="e.g. Tshirt" required />
            </div>
            
            <div className="space-y-3">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">TRACKING LABELS & DROPDOWN VALUES</p>
                
                <div className="grid grid-cols-1 gap-2.5">
                    {fields.map((f, i) => (
                        <div key={i} className="flex flex-col gap-1 p-3 bg-white border border-gray-200 rounded-2xl shadow-sm hover:border-yellow-200 transition-colors">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[8px] font-bold text-gray-400 uppercase mb-0.5 ml-1 text-black">FIELD {i+1} LABEL</label>
                                    <input 
                                        type="text" 
                                        value={f.label} 
                                        onChange={e => handleFieldChange(i, 'label', e.target.value)} 
                                        className={darkInput}
                                        placeholder={`e.g. ${['Neck', 'Brand', 'Color', 'Material', 'Size'][i]}`} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[8px] font-bold text-gray-400 uppercase mb-0.5 ml-1 text-black">DROPDOWN OPTIONS (COMMA SEP.)</label>
                                    <input 
                                        type="text" 
                                        value={f.options} 
                                        onChange={e => handleFieldChange(i, 'options', e.target.value)} 
                                        className={optionInput}
                                        placeholder="v-neck, round, collared" 
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-transform uppercase tracking-widest text-[11px] mt-4 border border-yellow-400/20 hover:bg-gray-800">
                Update Management Schema
            </button>
        </form>
    );
};

// --- Product Modal ---
const ProductModal: React.FC<{
    isOpen: boolean; onClose: () => void; product: InventoryItem | null; categoryDefault: string;
    productCategories: ProductCategory[]; onSave: (data: Partial<InventoryItem>) => Promise<void>;
}> = ({ isOpen, onClose, product, categoryDefault, productCategories, onSave }) => {
    const [formData, setFormData] = useState({
        name: '', category: categoryDefault || '', price: 0, minPrice: 0, purchasePrice: 0, quantity: 0, minStockLevel: 5, sku: '', isConsumable: false,
        attr1: '', attr2: '', attr3: '', attr4: '', attr5: ''
    });

    const activeConfig = useMemo(() => productCategories.find(c => c.name === formData.category), [formData.category, productCategories]);

    useEffect(() => {
        if (product) {
            setFormData({
                name: product.name,
                category: product.category,
                price: product.price,
                minPrice: product.minPrice || 0,
                purchasePrice: product.purchasePrice || 0,
                quantity: product.quantity,
                minStockLevel: product.minStockLevel,
                sku: product.sku,
                isConsumable: !!product.isConsumable,
                attr1: product.attr1 || '',
                attr2: product.attr2 || '',
                attr3: product.attr3 || '',
                attr4: product.attr4 || '',
                attr5: product.attr5 || '',
            });
        }
        else setFormData({ name: '', category: categoryDefault, price: 0, minPrice: 0, purchasePrice: 0, quantity: 0, minStockLevel: 5, sku: `SKU-${Date.now()}`, isConsumable: categoryDefault === 'Supplies', attr1: '', attr2: '', attr3: '', attr4: '', attr5: '' });
    }, [product, categoryDefault, isOpen]);

    const darkInput = "mt-1 block w-full rounded-lg border border-gray-300 bg-white text-black shadow-sm focus:ring-2 focus:ring-yellow-400 sm:text-sm py-2 px-3 placeholder-gray-400 font-bold transition-all";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? 'Edit Item Record' : 'Add New Item Record'}>
            <div className="space-y-5">
                <form onSubmit={e => { e.preventDefault(); onSave(formData); }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-1">
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 text-black">Name</label>
                            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={darkInput} required placeholder="e.g. Tshirt" />
                        </div>
                        <div className="col-span-1">
                            <label className="block text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 text-black">Category Type</label>
                            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={darkInput} required>
                                <option value="" className="bg-white text-black">Select Template</option>
                                <option value="Supplies" className="bg-white text-black">Consumables (Ink/etc)</option>
                                {productCategories.map(c => <option key={c.id} value={c.name} className="bg-white text-black">{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pricing Architecture</p>
                        <div className="grid grid-cols-1 gap-3">
                             <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block text-black">Cost (Purchase)</label>
                                    <input type="text" value={formatNumberWithCommas(formData.purchasePrice)} onChange={e => setFormData({...formData, purchasePrice: parseCommaString(e.target.value)})} className={darkInput} placeholder="0"/>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1 block">Preferred Selling Price</label>
                                    <input type="text" value={formatNumberWithCommas(formData.price)} onChange={e => setFormData({...formData, price: parseCommaString(e.target.value)})} className={`${darkInput} border-blue-200 ring-1 ring-blue-500`} placeholder="0"/>
                                </div>
                             </div>
                             <div className="w-full">
                                <label className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1 block">Minimum Negotiable Price (Discount Limit)</label>
                                <input type="text" value={formatNumberWithCommas(formData.minPrice)} onChange={e => setFormData({...formData, minPrice: parseCommaString(e.target.value)})} className={`${darkInput} border-red-200 ring-1 ring-red-500`} placeholder="0"/>
                             </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block text-black">Stock Quantity</label>
                            <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})} className={darkInput}/>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block text-black">Min Alert Level</label>
                            <input type="number" value={formData.minStockLevel} onChange={e => setFormData({...formData, minStockLevel: parseInt(e.target.value) || 0})} className={darkInput}/>
                        </div>
                    </div>

                    {activeConfig && (
                        <div className="pt-4 border-t border-gray-100 mt-2">
                             <h4 className="text-[9px] font-black text-yellow-600 uppercase tracking-[0.2em] mb-4 text-center bg-yellow-50 py-1.5 rounded-lg">CUSTOM DETAILS FOR {activeConfig.name.toUpperCase()}</h4>
                             <div className="grid grid-cols-2 gap-3">
                                {[1,2,3,4,5].map(num => {
                                    const label = (activeConfig as any)[`field${num}`];
                                    const options = (activeConfig as any)[`field${num}Options`] as string[];
                                    if (!label) return null;
                                    
                                    return (
                                        <div key={num}>
                                            <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block text-black">{label}</label>
                                            {options && options.length > 0 ? (
                                                <select 
                                                    value={(formData as any)[`attr${num}`]} 
                                                    onChange={e => setFormData({...formData, [`attr${num}`]: e.target.value})} 
                                                    className={darkInput}
                                                >
                                                    <option value="" className="bg-white text-black">-- Select --</option>
                                                    {options.map(opt => <option key={opt} value={opt} className="bg-white text-black">{opt}</option>)}
                                                </select>
                                            ) : (
                                                <input 
                                                    type="text" 
                                                    value={(formData as any)[`attr${num}`]} 
                                                    onChange={e => setFormData({...formData, [`attr${num}`]: e.target.value})} 
                                                    className={darkInput} 
                                                    placeholder={label}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                             </div>
                        </div>
                    )}
                    <div className="pt-2">
                        <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black shadow-lg hover:bg-blue-700 transition-all uppercase text-xs tracking-[0.2em] active:scale-95 shadow-blue-500/20">Save Product Record</button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

// --- Sub-components for Setup View ---

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

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-black">Material Categories</h3>
                    <button onClick={() => setIsAddCatModalOpen(true)} className="text-blue-600 flex items-center text-sm font-bold"><PlusIcon className="w-4 h-4 mr-1"/> Add Category</button>
                </div>
                <div className="space-y-2">
                    {materialCategories.map(cat => (
                        <div key={cat.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="font-bold text-sm text-black">{cat.name}</span>
                            <div className="flex gap-2">
                                <button onClick={() => { const n = prompt('New name:', cat.name); if(n) onUpdateCategory(cat.id, n); }} className="text-gray-400 hover:text-blue-600"><EditIcon className="w-4 h-4"/></button>
                                <button onClick={() => onDeleteCategory(cat)} className="text-gray-400 hover:text-red-600"><TrashIcon className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-black">Inventory SKUs (Rolls)</h3>
                    <button onClick={() => setIsAddSkuModalOpen(true)} className="text-blue-600 flex items-center text-sm font-bold"><PlusIcon className="w-4 h-4 mr-1"/> Add SKU</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-700">
                            <tr>
                                <th className="px-4 py-3">Item Name</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Width</th>
                                <th className="px-4 py-3">Reorder Level</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stockItems.map(item => (
                                <tr key={item.skuId} className="border-b">
                                    <td className="px-4 py-3 font-bold text-black">{item.itemName}</td>
                                    <td className="px-4 py-3 text-black">{materialCategories.find(c => c.id === item.categoryId)?.name}</td>
                                    <td className="px-4 py-3 text-black">{item.width}m</td>
                                    <td className="px-4 py-3 text-black">{item.reorderLevel}m</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => { const r = prompt('New reorder level:', String(item.reorderLevel)); if(r) onUpdateStockItem(item.skuId, parseInt(r)); }} className="text-blue-600 mr-2"><EditIcon className="w-4 h-4"/></button>
                                        <button onClick={() => onDeleteStockItem(item.skuId)} className="text-red-600"><TrashIcon className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isAddCatModalOpen} onClose={() => setIsAddCatModalOpen(false)} title="Add Category">
                <form onSubmit={e => { e.preventDefault(); onAddCategory(catName); setIsAddCatModalOpen(false); setCatName(''); }} className="space-y-4">
                    <input type="text" value={catName} onChange={e => setCatName(e.target.value)} className="block w-full border rounded-lg p-2 text-black" placeholder="Category Name" required />
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">Create Category</button>
                </form>
            </Modal>

            <Modal isOpen={isAddSkuModalOpen} onClose={() => setIsAddSkuModalOpen(false)} title="Add SKU">
                <form onSubmit={e => { e.preventDefault(); onAddStockItem(selectedCatId, width, reorder, skuName); setIsAddSkuModalOpen(false); }} className="space-y-4">
                    <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className="block w-full border rounded-lg p-2 text-black" required>
                        <option value="" className="text-black">Select Category</option>
                        {materialCategories.map(c => <option key={c.id} value={c.id} className="text-black">{c.name}</option>)}
                    </select>
                    <input type="text" value={skuName} onChange={e => setSkuName(e.target.value)} className="block w-full border rounded-lg p-2 text-black" placeholder="SKU Item Name" required />
                    <input type="number" step="0.01" value={width} onChange={e => setWidth(parseFloat(e.target.value))} className="block w-full border rounded-lg p-2 text-black" placeholder="Width (meters)" required />
                    <input type="number" value={reorder} onChange={e => setReorder(parseInt(e.target.value))} className="block w-full border rounded-lg p-2 text-black" placeholder="Reorder Level (meters)" required />
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">Create SKU</button>
                </form>
            </Modal>
        </div>
    );
};

const PricingSetupView: React.FC<SetupViewProps> = ({ materialCategories, pricingTiers, onAddTier, onUpdateTier, onDeleteTier }) => {
    const [isAddTierModalOpen, setIsAddTierModalOpen] = useState(false);
    const [selectedCatId, setSelectedCatId] = useState('');
    const [tierName, setTierName] = useState('');
    const [value, setValue] = useState(0);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-black">Pricing Tiers (UGX per CM²)</h3>
                <button onClick={() => setIsAddTierModalOpen(true)} className="text-blue-600 flex items-center text-sm font-bold"><PlusIcon className="w-4 h-4 mr-1"/> Add Tier</button>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-700">
                        <tr>
                            <th className="px-4 py-3">Tier Name</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3 text-right">Value (UGX/cm²)</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pricingTiers.map(tier => (
                            <tr key={tier.id} className="border-b">
                                <td className="px-4 py-3 font-bold text-black">{tier.name}</td>
                                <td className="px-4 py-3 text-black">{materialCategories.find(c => c.id === tier.categoryId)?.name}</td>
                                <td className="px-4 py-3 text-right font-mono text-black">{tier.value.toFixed(4)}</td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => { const v = prompt('New value:', String(tier.value)); if(v) onUpdateTier(tier.id, tier.name, parseFloat(v)); }} className="text-blue-600 mr-2"><EditIcon className="w-4 h-4"/></button>
                                    <button onClick={() => onDeleteTier(tier.id)} className="text-red-600"><TrashIcon className="w-4 h-4"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isAddTierModalOpen} onClose={() => setIsAddTierModalOpen(false)} title="Add Pricing Tier">
                <form onSubmit={e => { e.preventDefault(); onAddTier(tierName, value, selectedCatId); setIsAddTierModalOpen(false); }} className="space-y-4">
                    <select value={selectedCatId} onChange={e => setSelectedCatId(e.target.value)} className="block w-full border rounded-lg p-2 text-black" required>
                        <option value="" className="text-black">Select Category</option>
                        {materialCategories.map(c => <option key={c.id} value={c.id} className="text-black">{c.name}</option>)}
                    </select>
                    <input type="text" value={tierName} onChange={e => setTierName(e.target.value)} className="block w-full border rounded-lg p-2 text-black" placeholder="Tier Name (e.g. Retail)" required />
                    <input type="number" step="0.0001" value={value} onChange={e => setValue(parseFloat(e.target.value))} className="block w-full border rounded-lg p-2 text-black" placeholder="Value per CM²" required />
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">Create Tier</button>
                </form>
            </Modal>
        </div>
    );
};

// --- Reports and Modals ---

const InventoryReportsView: React.FC<InventoryDashboardViewProps> = ({ filteredStockItems, filteredInventory }) => {
    const totalStockValue = filteredStockItems.reduce((acc, item) => acc + ((item.totalStockMeters || 0) / ROLL_LENGTH_METERS) * item.lastPurchasePricePerRoll_UGX, 0);
    const totalInventoryValue = filteredInventory.reduce((acc, item) => acc + item.quantity * item.price, 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
                <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Estimated Stock Value</h3>
                <p className="text-3xl font-black text-blue-800 mt-2">{formatUGX(totalStockValue)}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Inventory Asset Value</h3>
                <p className="text-3xl font-black text-green-800 mt-2">{formatUGX(totalInventoryValue)}</p>
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Stock-In (Add New Rolls)">
            <form onSubmit={async e => { e.preventDefault(); await onStockIn(skuId, rolls, price, notes); onClose(); }} className="space-y-4">
                <select value={skuId} onChange={e => setSkuId(e.target.value)} className="block w-full border rounded-lg p-2 text-black" required>
                    <option value="" className="text-black">Select SKU...</option>
                    {stockItems.map(i => <option key={i.skuId} value={i.skuId} className="text-black">{i.itemName}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" step="0.5" value={rolls} onChange={e => setRolls(parseFloat(e.target.value))} className="border rounded-lg p-2 text-black" placeholder="Number of Rolls" required />
                    <input type="number" value={price} onChange={e => setPrice(parseInt(e.target.value))} className="border rounded-lg p-2 text-black" placeholder="Price Per Roll" required />
                </div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border rounded-lg p-2 text-black" placeholder="Notes (Supplier, etc)"></textarea>
                <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-black uppercase tracking-widest text-sm">Log Stock-In</button>
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Stock-Out (Log Usage)">
            <form onSubmit={async e => { e.preventDefault(); await onStockOut(skuId, meters, jobId, notes); onClose(); }} className="space-y-4">
                <select value={skuId} onChange={e => setSkuId(e.target.value)} className="block w-full border rounded-lg p-2 text-black" required>
                    <option value="" className="text-black">Select Material...</option>
                    {stockItems.map(i => <option key={i.skuId} value={i.skuId} className="text-black">{i.itemName} ({(i.totalStockMeters || 0).toFixed(1)}m left)</option>)}
                </select>
                <input type="number" step="0.1" value={meters} onChange={e => setMeters(parseFloat(e.target.value))} className="w-full border rounded-lg p-2 text-black" placeholder="Meters Used" required />
                <input type="text" value={jobId} onChange={e => setJobId(e.target.value)} className="w-full border rounded-lg p-2 text-black" placeholder="Job/Invoice #" required />
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full border rounded-lg p-2 text-black" placeholder="Notes"></textarea>
                <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-lg font-black uppercase tracking-widest text-sm">Log Usage</button>
            </form>
        </Modal>
    );
};

export default InventoryView;
