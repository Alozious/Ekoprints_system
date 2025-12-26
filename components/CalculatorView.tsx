import React, { useState, useMemo, useEffect } from 'react';
import { StockItem, PricingTier, SaleItem, InventoryItem, MaterialCategory, ProductCategory } from '../types';
import { PlusIcon, TrashIcon, DocumentTextIcon, ChevronDownIcon } from './icons';
import { useToast } from '../App';

interface CalculatorViewProps {
    stockItems: StockItem[];
    pricingTiers: PricingTier[];
    inventory: InventoryItem[];
    materialCategories: MaterialCategory[];
    productCategories: ProductCategory[];
    onCreateSale: (items: SaleItem[]) => void;
}

type Unit = 'm' | 'ft' | 'in' | 'cm';

const CONVERSION_TO_METER: Record<Unit, number> = {
    m: 1,
    cm: 0.01,
    in: 0.0254,
    ft: 0.3048,
};

const PAPER_SIZES: Record<string, { width: number; height: number }> = {
    'A5': { width: 14.8, height: 21.0 },
    'A4': { width: 21.0, height: 29.7 },
    'A3': { width: 29.7, height: 42.0 },
    'A2': { width: 42.0, height: 59.4 },
    'A1': { width: 59.4, height: 84.1 },
    'A0': { width: 84.1, height: 118.9 },
};

const PAPER_SIZE_STYLES: Record<string, string> = {
    'A5': 'bg-red-100 text-red-800 hover:bg-red-200 border-red-200',
    'A4': 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200',
    'A3': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200',
    'A2': 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200',
    'A1': 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200',
    'A0': 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-200',
};

const CALCULATOR_TABS = [
    { id: 'large-format', label: 'Large Format', type: 'dimension' }, 
    { id: 'dtf', label: 'DTF', type: 'dimension' }, 
    { id: 'embroidery', label: 'Embroidery', type: 'simple' },
    { id: 'bizhub', label: 'Bizhub', type: 'simple' },
    { id: 'supplies', label: 'Supplies', type: 'simple' },
    { id: 'products', label: 'Products', type: 'simple' },
    { id: 'others', label: 'Others', type: 'manual' },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'embroidery': ['embroidery', 't-shirt', 'shirt', 'polo', 'cap', 'uniform', 'garment', 'jumper', 'hoodie'],
    'bizhub': ['bizhub', 'general', 'print', 'card', 'flyer', 'poster', 'book', 'document', 'paper'],
    'supplies': ['ink', 'powder', 'solution', 'clean', 'thread', 'toner', 'material'],
};

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

const formatNumberWithCommas = (val: number | string) => {
    if (val === '' || val === undefined || val === null) return '';
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    if (isNaN(num)) return '';
    if (num === 0) return '0';
    return new Intl.NumberFormat('en-US').format(num);
};

const parseCommaString = (val: string) => {
    const cleaned = val.replace(/,/g, '');
    return cleaned === '' ? 0 : parseFloat(cleaned);
};

const UnitConverterDisplay: React.FC<{ lengthM: number; widthM: number }> = ({ lengthM, widthM }) => {
    const conversions = (valM: number) => ({
        m: valM.toFixed(2),
        cm: (valM * 100).toFixed(1),
        ft: (valM / CONVERSION_TO_METER.ft).toFixed(2),
        in: (valM / CONVERSION_TO_METER.in).toFixed(2),
    });

    const length = conversions(lengthM);
    const width = conversions(widthM);

    return (
        <div className="bg-gray-50 p-2 rounded-md border border-gray-200 text-[10px] sm:text-xs">
            <h4 className="font-semibold text-gray-600 mb-1 text-center uppercase tracking-wider text-[9px]">CONVERTED DIMENSIONS</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                <span>L: <strong>{length.m}</strong> m</span>
                <span>W: <strong>{width.m}</strong> m</span>
                <span>L: <strong>{length.ft}</strong> ft</span>
                <span>W: <strong>{width.ft}</strong> ft</span>
                <span>L: <strong>{length.cm}</strong> cm</span>
                <span>W: <strong>{width.cm}</strong> cm</span>
            </div>
        </div>
    );
};

const CalculatorView: React.FC<CalculatorViewProps> = ({ stockItems, pricingTiers, inventory, materialCategories, productCategories, onCreateSale }) => {
    const [activeTab, setActiveTab] = useState(CALCULATOR_TABS[0].id);
    const [quoteItems, setQuoteItems] = useState<SaleItem[]>([]);
    const { addToast } = useToast();

    // Dimension Calc State
    const [length, setLength] = useState<number>(100); 
    const [lengthUnit, setLengthUnit] = useState<Unit>('cm');
    const [width, setWidth] = useState<number>(60);
    const [widthUnit, setWidthUnit] = useState<Unit>('cm');
    const [selectedStockItem, setSelectedStockItem] = useState('');
    const [selectedTier, setSelectedTier] = useState('');
    const [dimQuantity, setDimQuantity] = useState(1);
    
    // Fee Adjustment State
    const [extraAmount, setExtraAmount] = useState<number>(0);
    const [extraAmountLabel, setExtraAmountLabel] = useState<string>('');
    
    // DTF Special State
    const [dtfPreset, setDtfPreset] = useState<'A4' | 'A3' | null>(null);

    // Simple Calc (Cascading) State
    const [selectedProductCategory, setSelectedProductCategory] = useState<string>('');
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
    const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
    const [negotiatedPrice, setNegotiatedPrice] = useState<number>(0);
    const [simpleQuantity, setSimpleQuantity] = useState(1);

    // Others (Manual Entry) State
    const [manualItemName, setManualItemName] = useState('');
    const [manualPrice, setManualPrice] = useState<number>(0);
    const [manualQuantity, setManualQuantity] = useState<number>(1);

    const activeTabConfig = useMemo(() => CALCULATOR_TABS.find(t => t.id === activeTab) || CALCULATOR_TABS[0], [activeTab]);
    const isDTF = activeTab === 'dtf';

    const lengthInMeters = useMemo(() => length * CONVERSION_TO_METER[lengthUnit], [length, lengthUnit]);
    const widthInMeters = useMemo(() => width * CONVERSION_TO_METER[widthUnit], [width, widthUnit]);

    const visiblePaperSizes = useMemo(() => {
        if (isDTF) return ['A4', 'A3'];
        return Object.keys(PAPER_SIZES);
    }, [isDTF]);

    useEffect(() => {
        setExtraAmount(0);
        setExtraAmountLabel('');
        if (activeTabConfig.type === 'simple') {
            setSelectedProductCategory('');
            setActiveFilters({});
            setSelectedProduct(null);
            setSimpleQuantity(1);
            setNegotiatedPrice(0);
        }
        if (isDTF) {
            const dtfItems = stockItems.filter(item => {
                const cat = materialCategories.find(c => c.id === item.categoryId)?.name.toLowerCase() || '';
                return cat.includes('dtf') || item.itemName.toLowerCase().includes('dtf');
            });
            if (dtfItems.length > 0 && !selectedStockItem) {
                setSelectedStockItem(dtfItems[0].skuId);
                setWidth(dtfItems[0].width * 100); 
                setWidthUnit('cm');
            }
        }
    }, [activeTab, stockItems, materialCategories, isDTF, activeTabConfig.type]);

    const filteredProductCategories = useMemo(() => {
        if (activeTab === 'products') return productCategories;
        const keywords = CATEGORY_KEYWORDS[activeTab];
        if (!keywords) return productCategories;
        return productCategories.filter(cat => 
            keywords.some(k => cat.name.toLowerCase().includes(k))
        );
    }, [productCategories, activeTab]);

    const activeConfig = useMemo(() => 
        productCategories.find(c => c.name === selectedProductCategory),
    [selectedProductCategory, productCategories]);

    const filteredInventory = useMemo(() => {
        if (!selectedProductCategory) return [];
        return inventory.filter(item => {
            if (item.category !== selectedProductCategory) return false;
            if (activeTab !== 'supplies' && item.isConsumable) return false;

            if (activeFilters.attr1 && item.attr1 !== activeFilters.attr1) return false;
            if (activeFilters.attr2 && item.attr2 !== activeFilters.attr2) return false;
            if (activeFilters.attr3 && item.attr3 !== activeFilters.attr3) return false;
            if (activeFilters.attr4 && item.attr4 !== activeFilters.attr4) return false;
            if (activeFilters.attr5 && item.attr5 !== activeFilters.attr5) return false;
            return true;
        });
    }, [inventory, selectedProductCategory, activeFilters, activeTab]);

    // Dimension Calc Tiers
    const availableStockItems = useMemo(() => {
        if (activeTabConfig.type !== 'dimension') return [];
        return stockItems.filter(item => {
             const cat = materialCategories.find(c => c.id === item.categoryId);
             const catName = cat ? cat.name.toLowerCase() : '';
             if (isDTF) return ['dtf', 'direct to film'].some(match => catName.includes(match));
             return !['dtf', 'direct to film'].some(match => catName.includes(match));
        });
    }, [stockItems, materialCategories, activeTab, activeTabConfig, isDTF]);

    const dtfRollOptions = useMemo(() => {
        if (!isDTF) return [];
        const uniqueWidths = Array.from(new Set(availableStockItems.map(i => i.width))).sort((a: number, b: number) => a - b);
        return uniqueWidths.map((w: number) => {
            const item = availableStockItems.find(i => i.width === w);
            return {
                width: w,
                label: `${w < 1 ? w * 100 : w} ${w < 1 ? 'cm' : 'm'} Roll`,
                skuId: item?.skuId || ''
            };
        });
    }, [availableStockItems, isDTF]);

    const tiersForSelectedItem = useMemo(() => {
        if (!selectedStockItem) return [];
        const categoryId = stockItems.find(i => i.skuId === selectedStockItem)?.categoryId;
        if (!categoryId) return [];
        return pricingTiers.filter(tier => tier.categoryId === categoryId);
    }, [selectedStockItem, stockItems, pricingTiers]);

    const selectedMultiplier = useMemo(() => {
        if (!selectedTier) return 0;
        return tiersForSelectedItem.find(t => t.id === selectedTier)?.value || 0;
    }, [selectedTier, tiersForSelectedItem]);

    const totalDimPrice = useMemo(() => {
        let basePrice = 0;
        if (isDTF) {
            if (dtfPreset === 'A4') basePrice = 5000 * dimQuantity;
            else if (dtfPreset === 'A3') basePrice = 10000 * dimQuantity;
            else basePrice = lengthInMeters * 15000 * dimQuantity;
        } else {
            const lengthCM = lengthInMeters * 100;
            const widthCM = widthInMeters * 100;
            basePrice = lengthCM * widthCM * selectedMultiplier * dimQuantity;
        }
        return basePrice + extraAmount;
    }, [lengthInMeters, widthInMeters, selectedMultiplier, dimQuantity, isDTF, dtfPreset, extraAmount]);

    const totalSimplePrice = useMemo(() => {
        return (negotiatedPrice * simpleQuantity) + extraAmount;
    }, [negotiatedPrice, simpleQuantity, extraAmount]);
    
    const totalManualPrice = useMemo(() => {
        return (manualPrice * manualQuantity);
    }, [manualPrice, manualQuantity]);

    const handlePresetClick = (name: string, size: {width: number; height: number}) => {
        if (isDTF) {
            if (name === 'A4') { setDtfPreset('A4'); setLength(29.7); setLengthUnit('cm'); }
            else if (name === 'A3') { setDtfPreset('A3'); setLength(42.0); setLengthUnit('cm'); }
            else { setDtfPreset(null); setLength(size.height); setLengthUnit('cm'); }
        } else {
             setWidth(size.width); setLength(size.height); setWidthUnit('cm'); setLengthUnit('cm');
        }
    };

    const handleAddDimToQuote = () => {
        if (!selectedStockItem) { addToast("Please select a material/roll.", "error"); return; }
        if (!isDTF && !selectedTier) { addToast("Please select a pricing tier.", "error"); return; }
        if (totalDimPrice <= 0) { addToast("Calculated price must be greater than zero.", "error"); return; }
        
        const stockItem = stockItems.find(i => i.skuId === selectedStockItem);
        if (!stockItem) return;

        let itemName = stockItem.itemName;
        if (isDTF) {
            if (dtfPreset) itemName += ` (${dtfPreset})`;
            else itemName += ` (Custom Length: ${lengthInMeters.toFixed(2)}m)`;
        } else {
             itemName += ` (${(lengthInMeters).toFixed(2)}m x ${(widthInMeters).toFixed(2)}m)`;
        }

        if (extraAmount > 0) {
            const label = extraAmountLabel.trim() || 'Extra';
            itemName += ` + ${label}: ${formatUGX(extraAmount)}`;
        }

        const newItem: SaleItem = {
            itemId: `calc-${stockItem.skuId}-${Date.now()}`,
            name: itemName,
            quantity: dimQuantity,
            price: totalDimPrice / dimQuantity,
        };
        setQuoteItems(prev => [...prev, newItem]);
        setDimQuantity(1);
        setExtraAmount(0);
        setExtraAmountLabel('');
        if (isDTF) setDtfPreset(null);
    };

    const handleAddSimpleToQuote = () => {
        if (!selectedProduct) { addToast("Please select a product from the filtered list.", "error"); return; }
        if (simpleQuantity <= 0) { addToast("Quantity must be greater than 0.", "error"); return; }
        
        if (negotiatedPrice < (selectedProduct.minPrice || 0)) {
            addToast(`Price cannot be below the minimum discount price of ${formatUGX(selectedProduct.minPrice || 0)}.`, "error");
            return;
        }

        let displayName = selectedProduct.name;
        const attributes = [
            selectedProduct.attr1,
            selectedProduct.attr2,
            selectedProduct.attr3,
            selectedProduct.attr4,
            selectedProduct.attr5
        ].filter(Boolean).join(' | ');
        if (attributes) displayName += ` (${attributes})`;

        if (extraAmount > 0) {
            const label = extraAmountLabel.trim() || 'Extra Fee/Design';
            displayName += ` (+ ${label}: ${formatUGX(extraAmount)})`;
        }

        const newItem: SaleItem = {
            itemId: `simple-${selectedProduct.id}-${Date.now()}`,
            name: displayName,
            quantity: simpleQuantity,
            price: negotiatedPrice + (extraAmount / simpleQuantity),
        };
        
        setQuoteItems(prev => [...prev, newItem]);
        setSimpleQuantity(1);
        setExtraAmount(0);
        setExtraAmountLabel('');
        setSelectedProduct(null);
        setNegotiatedPrice(0);
    };

    const handleAddManualToQuote = () => {
        if (!manualItemName.trim()) { addToast("Please enter an item name.", "error"); return; }
        if (manualPrice <= 0) { addToast("Price must be greater than zero.", "error"); return; }
        if (manualQuantity <= 0) { addToast("Quantity must be greater than zero.", "error"); return; }

        const newItem: SaleItem = {
            itemId: `manual-${Date.now()}`,
            name: manualItemName.trim(),
            quantity: manualQuantity,
            price: manualPrice,
        };
        
        setQuoteItems(prev => [...prev, newItem]);
        setManualItemName('');
        setManualPrice(0);
        setManualQuantity(1);
    };
    
    const handleClearQuote = () => setQuoteItems([]);
    const handleRemoveQuoteItem = (index: number) => setQuoteItems(prev => prev.filter((_, i) => i !== index));

    const handleCreateSaleClick = () => {
        if (quoteItems.length === 0) { addToast("Your quote is empty. Add items to create a sale.", "error"); return; }
        onCreateSale(quoteItems);
        handleClearQuote();
    };

    const totalQuotePrice = useMemo(() => quoteItems.reduce((acc, item) => acc + item.price * item.quantity, 0), [quoteItems]);

    const activeTabClass = "border-yellow-500 text-yellow-600 bg-yellow-50 shadow-sm";
    const inactiveTabClass = "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300";
    const darkInputClass = "block w-full rounded-md border border-gray-300 bg-white text-black shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm placeholder-gray-400 font-bold px-3 py-2.5";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden h-fit border border-gray-100">
                <div className="flex overflow-x-auto border-b border-gray-200 no-scrollbar bg-gray-50 p-1 gap-1">
                    {CALCULATOR_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 min-w-[100px] py-3 px-2 text-[10px] font-black text-center border-b-2 whitespace-nowrap transition-all uppercase tracking-widest rounded-t-md ${activeTab === tab.id ? activeTabClass : inactiveTabClass}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-5 space-y-6">
                    {activeTabConfig.type === 'dimension' && (
                        <div className="fade-in space-y-5">
                            <div className={`grid ${isDTF ? 'grid-cols-2' : 'grid-cols-6'} gap-1.5`}>
                                {visiblePaperSizes.map((name) => (
                                    <button key={name} onClick={() => handlePresetClick(name, PAPER_SIZES[name])} className={`py-2 text-[10px] font-black rounded shadow-sm transition-all hover:scale-105 uppercase tracking-tighter ${PAPER_SIZE_STYLES[name] || 'bg-gray-100 text-gray-700'}`}>{name}</button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 text-black">LENGTH</label>
                                    <div className="flex">
                                        <input type="number" value={length} onChange={e => { setLength(parseFloat(e.target.value) || 0); if (isDTF) setDtfPreset(null); }} className={`rounded-r-none ${darkInputClass}`} />
                                        <select value={lengthUnit} onChange={e => setLengthUnit(e.target.value as Unit)} className="rounded-r-md border-l-0 border-gray-300 bg-white text-black text-xs font-black uppercase focus:border-yellow-500 focus:ring-yellow-500 px-2">
                                            {Object.keys(CONVERSION_TO_METER).map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1 text-black">{isDTF ? 'ROLL WIDTH' : 'WIDTH'}</label>
                                    {isDTF ? (
                                        <select value={selectedStockItem} onChange={e => { setSelectedStockItem(e.target.value); const itm = stockItems.find(i => i.skuId === e.target.value); if (itm) { setWidth(itm.width * 100); setWidthUnit('cm'); } }} className={darkInputClass}>
                                            <option value="" className="bg-white text-black">Select Roll...</option>
                                            {dtfRollOptions.map(opt => <option key={opt.skuId} value={opt.skuId} className="bg-white text-black">{opt.label}</option>)}
                                        </select>
                                    ) : (
                                        <div className="flex">
                                            <input type="number" value={width} onChange={e => setWidth(parseFloat(e.target.value) || 0)} className={`rounded-r-none ${darkInputClass}`} />
                                            <select value={widthUnit} onChange={e => setWidthUnit(e.target.value as Unit)} className="rounded-r-md border-l-0 border-gray-300 bg-white text-black text-xs font-black uppercase focus:border-yellow-500 focus:ring-yellow-500 px-2">
                                                {Object.keys(CONVERSION_TO_METER).map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <UnitConverterDisplay lengthM={lengthInMeters} widthM={widthInMeters} />

                            <div className="space-y-4 pt-4 border-t border-gray-50">
                                {!isDTF && (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1 text-black">MATERIAL</label>
                                                <select value={selectedStockItem} onChange={e => setSelectedStockItem(e.target.value)} className={darkInputClass}>
                                                    <option value="" className="bg-white text-black">SELECT MATERIAL...</option>
                                                    {availableStockItems.map(item => <option key={item.skuId} value={item.skuId} className="bg-white text-black">{item.itemName}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1 text-black">PRICING TIER</label>
                                                <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)} className={darkInputClass} disabled={!selectedStockItem}>
                                                    <option value="" className="bg-white text-black">SELECT TIER...</option>
                                                    {tiersForSelectedItem.map(tier => <option key={tier.id} value={tier.id} className="bg-white text-black">{tier.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1 text-black">QUANTITY</label>
                                    <input type="number" min="1" value={dimQuantity} onChange={e => setDimQuantity(parseInt(e.target.value) || 1)} className={darkInputClass} />
                                </div>
                            </div>
                            
                            <div className="p-4 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl text-center">
                                <p className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em]">CALCULATED UNIT PRICE</p>
                                <p className="text-4xl font-black text-blue-800 mt-1">{formatUGX(totalDimPrice)}</p>
                                {isDTF && <p className="text-[10px] text-blue-500 font-bold mt-1 uppercase tracking-widest">{dtfPreset ? `${dtfPreset} PRESET` : 'CUSTOM METERAGE'}</p>}
                            </div>
                            
                            <button onClick={handleAddDimToQuote} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest text-xs">Append to Order</button>
                        </div>
                    )}

                    {activeTabConfig.type === 'simple' && (
                        <div className="fade-in space-y-6">
                             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1 text-black">PRIMARY CATEGORY FOR {activeTab.toUpperCase()}</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {filteredProductCategories.map(cat => (
                                        <button 
                                            key={cat.id} 
                                            onClick={() => { setSelectedProductCategory(cat.name); setActiveFilters({}); setSelectedProduct(null); setNegotiatedPrice(0); }}
                                            className={`py-3 px-2 text-[10px] font-black rounded-xl border-2 transition-all uppercase tracking-tighter ${selectedProductCategory === cat.name ? 'bg-yellow-100 border-yellow-400 text-yellow-800 shadow-inner' : 'bg-white border-gray-100 text-gray-400 hover:border-yellow-200'}`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                    {filteredProductCategories.length === 0 && (
                                        <p className="col-span-full text-center py-4 text-xs text-gray-400 italic">No categories defined for this module.</p>
                                    )}
                                </div>
                            </div>

                            {activeConfig && (
                                <div className="space-y-4 pt-4 border-t border-gray-100 slide-in-up">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">REFINE SELECTION (CASCADING FILTERS)</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {[1,2,3,4,5].map(num => {
                                            const label = (activeConfig as any)[`field${num}`];
                                            const options = (activeConfig as any)[`field${num}Options`] as string[];
                                            if (!label) return null;
                                            return (
                                                <div key={num}>
                                                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1 ml-1 text-black">{label}</label>
                                                    <select 
                                                        value={activeFilters[`attr${num}`] || ''} 
                                                        onChange={e => { setActiveFilters(prev => ({ ...prev, [`attr${num}`]: e.target.value })); setSelectedProduct(null); setNegotiatedPrice(0); }}
                                                        className={darkInputClass}
                                                    >
                                                        <option value="" className="bg-white text-black">-- ALL {label.toUpperCase()} --</option>
                                                        {options.map(o => <option key={o} value={o} className="bg-white text-black">{o}</option>)}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 text-black">AVAILABLE STOCK MATCHES ({filteredInventory.length})</label>
                                        <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 p-2 rounded-xl bg-gray-50/50 scrollbar-thin">
                                            {filteredInventory.map(item => (
                                                <button 
                                                    key={item.id} 
                                                    onClick={() => { setSelectedProduct(item); setNegotiatedPrice(item.price); }}
                                                    className={`w-full flex justify-between items-center p-3 rounded-xl border-2 transition-all ${selectedProduct?.id === item.id ? 'bg-green-100 border-green-500 text-green-900 shadow-md scale-[1.01]' : 'bg-white border-transparent hover:border-green-100 text-black'}`}
                                                >
                                                    <div className="text-left">
                                                        <p className="text-xs font-black uppercase tracking-tight text-black">{item.name}</p>
                                                        <p className="text-[9px] opacity-70 font-bold text-black">{[item.attr1, item.attr2, item.attr3, item.attr4, item.attr5].filter(Boolean).join(' · ')}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black text-black">{formatUGX(item.price)}</p>
                                                        <p className={`text-[8px] font-bold ${item.quantity <= (item.minStockLevel || 5) ? 'text-red-500' : 'text-gray-500'}`}>Qty: {item.quantity}</p>
                                                    </div>
                                                </button>
                                            ))}
                                            {filteredInventory.length === 0 && <p className="text-center py-8 text-xs text-gray-400 font-bold italic">No items match your current selection criteria.</p>}
                                        </div>
                                    </div>

                                    {selectedProduct && (
                                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 space-y-4 slide-in-up">
                                            <div className="flex justify-between items-end gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1 ml-1">NEGOTIATED UNIT PRICE (UGX)</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="text" 
                                                            value={formatNumberWithCommas(negotiatedPrice)} 
                                                            onChange={e => setNegotiatedPrice(parseCommaString(e.target.value))} 
                                                            className={`block w-full rounded-md border-2 ${negotiatedPrice < (selectedProduct.minPrice || 0) ? 'border-red-500 focus:border-red-600 focus:ring-red-600' : 'border-gray-300 focus:border-yellow-500 focus:ring-yellow-500'} bg-white text-black shadow-sm sm:text-sm font-black px-3 py-2.5`}
                                                        />
                                                        {negotiatedPrice < (selectedProduct.minPrice || 0) && (
                                                            <p className="text-[9px] text-red-600 font-bold mt-1 ml-1 uppercase">Below limit: {formatUGX(selectedProduct.minPrice || 0)}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase">Preferred: {formatUGX(selectedProduct.price)}</p>
                                                    <p className="text-[9px] font-black text-red-400 uppercase">Min Limit: {formatUGX(selectedProduct.minPrice || 0)}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1 text-black">QUANTITY</label>
                                                    <input type="number" min="1" value={simpleQuantity} onChange={e => setSimpleQuantity(parseInt(e.target.value) || 1)} className={darkInputClass} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 ml-1">DESIGN/EXTRA FEE (UGX)</label>
                                                    <input type="text" value={formatNumberWithCommas(extraAmount)} onChange={e => setExtraAmount(parseCommaString(e.target.value))} className={`${darkInputClass} border-2 border-blue-100 focus:border-blue-400`} placeholder="0" />
                                                </div>
                                            </div>

                                            <div className="p-4 bg-green-50 border-2 border-dashed border-green-200 rounded-xl text-center">
                                                <p className="text-[10px] text-green-500 font-black uppercase tracking-[0.2em]">AGGREGATE ITEM COST</p>
                                                <p className="text-4xl font-black text-green-700 mt-1">{formatUGX(totalSimplePrice)}</p>
                                            </div>

                                            <button 
                                                onClick={handleAddSimpleToQuote} 
                                                disabled={negotiatedPrice < (selectedProduct.minPrice || 0)}
                                                className="w-full bg-green-600 text-white font-black py-4 rounded-xl shadow-xl hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale uppercase tracking-widest text-xs"
                                            >
                                                Append Item(s) to Quote
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTabConfig.id === 'others' && (
                        <div className="fade-in space-y-4">
                            <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest border-l-4 border-orange-500 pl-3">Miscellaneous Item Entry</h4>
                            <div className="space-y-4">
                                <input type="text" placeholder="ITEM DESIGNATION (E.G. DELIVERY)" value={manualItemName} onChange={e => setManualItemName(e.target.value)} className={darkInputClass} />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" placeholder="PRICE (UGX)" value={formatNumberWithCommas(manualPrice)} onChange={e => setManualPrice(parseCommaString(e.target.value))} className={darkInputClass} />
                                    <input type="number" placeholder="QTY" value={manualQuantity || ''} onChange={e => setManualQuantity(parseFloat(e.target.value) || 0)} className={darkInputClass} />
                                </div>
                                <div className="p-4 bg-orange-50 border-2 border-dashed border-orange-200 rounded-xl text-center">
                                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-[0.2em]">CALCULATED VALUE</p>
                                    <p className="text-4xl font-black text-orange-700 mt-1">{formatUGX(totalManualPrice)}</p>
                                </div>
                                <button onClick={handleAddManualToQuote} className="w-full bg-orange-600 text-white font-black py-4 rounded-xl shadow-xl hover:bg-orange-700 transition-all active:scale-95 uppercase tracking-widest text-xs">Append Custom Item</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-xl h-fit sticky top-4 border border-gray-100">
                <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
                    <div className="flex items-center">
                         <div className="bg-yellow-400 p-2 rounded-lg mr-3 text-[#1A2232] shadow-sm"><DocumentTextIcon className="w-5 h-5" /></div>
                         <h3 className="text-lg font-black text-gray-800 tracking-tight uppercase">Order Scratchpad</h3>
                    </div>
                    <div>
                        <button onClick={handleClearQuote} className="text-[10px] font-black text-gray-400 hover:text-red-500 mr-4 uppercase tracking-widest transition-colors">Wipe All</button>
                        <button onClick={handleCreateSaleClick} disabled={quoteItems.length === 0} className="text-xs font-black bg-[#1A2232] text-yellow-400 px-6 py-2.5 rounded-xl shadow-lg hover:bg-gray-800 transition-all disabled:opacity-30 disabled:grayscale uppercase tracking-widest">Post Order</button>
                    </div>
                </div>
                
                <div className="space-y-3">
                    {quoteItems.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                            <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                            <p className="font-black text-gray-300 text-xs uppercase tracking-widest">No Items Prepared</p>
                        </div>
                    ) : (
                        <>
                            <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3 scrollbar-thin">
                                {quoteItems.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center p-4 bg-gray-50/50 rounded-2xl border border-gray-100 group hover:border-yellow-200 transition-all">
                                        <div className="overflow-hidden mr-3">
                                            <p className="font-black text-gray-800 text-[11px] truncate uppercase tracking-tight" title={item.name}>{item.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{item.quantity} Unit(s) @ {formatUGX(item.price)}</p>
                                        </div>
                                        <div className="flex items-center shrink-0">
                                            <p className="font-black text-gray-900 text-xs mr-4">{formatUGX(item.price * item.quantity)}</p>
                                            <button onClick={() => handleRemoveQuoteItem(index)} className="p-2 bg-white text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl shadow-sm transition-all"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                             <div className="pt-6 mt-4 border-t-4 border-double border-gray-100">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] block mb-1">PROVISIONAL TOTAL</span>
                                        <span className="text-4xl font-black text-blue-800 tracking-tighter leading-none">{formatUGX(totalQuotePrice)}</span>
                                    </div>
                                    <div className="text-right">
                                         <p className="text-[9px] text-gray-300 font-bold uppercase italic">* Final taxes applied at checkout</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CalculatorView;