
import React, { useState, useMemo, useEffect } from 'react';
import { StockItem, PricingTier, SaleItem, InventoryItem, MaterialCategory, ProductCategory } from '../types';
import { PlusIcon, TrashIcon, DocumentTextIcon, ChevronDownIcon, SearchIcon, BeakerIcon } from './icons';
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
    'A5': 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100',
    'A4': 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100',
    'A3': 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100',
    'A2': 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100',
    'A1': 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100',
    'A0': 'bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100',
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
        <div className="bg-white p-3 rounded-2xl border border-gray-100 text-[10px] sm:text-xs shadow-sm">
            <h4 className="font-black text-gray-400 mb-2 text-center uppercase tracking-widest text-[8px]">Converted Dimensions</h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-gray-700">
                <span className="flex justify-between border-b border-gray-50 pb-1">L: <strong className="text-black">{length.m} m</strong></span>
                <span className="flex justify-between border-b border-gray-50 pb-1">W: <strong className="text-black">{width.m} m</strong></span>
                <span className="flex justify-between border-b border-gray-50 pb-1">L: <strong className="text-black">{length.ft} ft</strong></span>
                <span className="flex justify-between border-b border-gray-50 pb-1">W: <strong className="text-black">{width.ft} ft</strong></span>
                <span className="flex justify-between">L: <strong className="text-black">{length.cm} cm</strong></span>
                <span className="flex justify-between">W: <strong className="text-black">{width.cm} cm</strong></span>
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
    const [negotiatedDimPrice, setNegotiatedDimPrice] = useState<number>(0);
    const [dimNotes, setDimNotes] = useState('');
    
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
    const [itemSearchQuery, setItemSearchQuery] = useState('');
    const [simpleNotes, setSimpleNotes] = useState('');

    // Others (Manual Entry) State
    const [manualItemName, setManualItemName] = useState('');
    const [manualPrice, setManualPrice] = useState<number>(0);
    const [manualQuantity, setManualQuantity] = useState<number>(1);
    const [manualNotes, setManualNotes] = useState('');

    const activeTabConfig = useMemo(() => CALCULATOR_TABS.find(t => t.id === activeTab) || CALCULATOR_TABS[0], [activeTab]);
    const isDTF = activeTab === 'dtf';

    const lengthInMeters = useMemo(() => length * CONVERSION_TO_METER[lengthUnit], [length, lengthUnit]);
    const widthInMeters = useMemo(() => width * CONVERSION_TO_METER[widthUnit], [width, widthUnit]);

    const visiblePaperSizes = useMemo(() => {
        if (isDTF) return ['A4', 'A3'];
        return Object.keys(PAPER_SIZES);
    }, [isDTF]);

    // Dimension Calc Logic
    const availableStockItems = useMemo(() => {
        if (activeTabConfig.type !== 'dimension') return [];
        return stockItems.filter(item => {
             const cat = materialCategories.find(c => c.id === item.categoryId);
             const catName = cat ? cat.name.toLowerCase() : '';
             if (isDTF) return ['dtf', 'direct to film'].some(match => catName.includes(match));
             return !['dtf', 'direct to film'].some(match => catName.includes(match));
        });
    }, [stockItems, materialCategories, activeTab, activeTabConfig, isDTF]);

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

    // Derived Raw Calculation (before negotiation)
    const rawCalculatedDimPrice = useMemo(() => {
        let basePrice = 0;
        if (isDTF) {
            if (dtfPreset === 'A4') basePrice = 5000;
            else if (dtfPreset === 'A3') basePrice = 10000;
            else basePrice = lengthInMeters * 15000;
        } else {
            const lengthCM = lengthInMeters * 100;
            const widthCM = widthInMeters * 100;
            basePrice = lengthCM * widthCM * selectedMultiplier;
        }
        return Math.round(basePrice);
    }, [lengthInMeters, widthInMeters, selectedMultiplier, isDTF, dtfPreset]);

    // Sync negotiated dim price when raw changes
    useEffect(() => {
        setNegotiatedDimPrice(rawCalculatedDimPrice);
    }, [rawCalculatedDimPrice]);

    useEffect(() => {
        setExtraAmount(0);
        setExtraAmountLabel('');
        setItemSearchQuery('');
        setDimNotes('');
        setSimpleNotes('');
        setManualNotes('');
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

    const totalDimPrice = useMemo(() => {
        return (negotiatedDimPrice * dimQuantity) + extraAmount;
    }, [negotiatedDimPrice, dimQuantity, extraAmount]);

    // Cascading Filters for Products
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
        let items = inventory;
        if (activeTab === 'supplies') {
            items = items.filter(i => i.isConsumable);
        } else {
            items = items.filter(i => !i.isConsumable);
            const keywords = CATEGORY_KEYWORDS[activeTab];
            if (keywords && activeTab !== 'products') {
                items = items.filter(i => keywords.some(k => i.category.toLowerCase().includes(k) || i.name.toLowerCase().includes(k)));
            }
        }
        if (itemSearchQuery.trim()) {
            const query = itemSearchQuery.toLowerCase();
            items = items.filter(i => 
                i.name.toLowerCase().includes(query) || 
                i.category.toLowerCase().includes(query) ||
                [i.attr1, i.attr2, i.attr3, i.attr4, i.attr5].some(a => a?.toLowerCase().includes(query))
            );
        }
        if (selectedProductCategory) {
            items = items.filter(i => i.category === selectedProductCategory);
            if (activeFilters.attr1 && items.some(i => i.attr1 === activeFilters.attr1)) items = items.filter(i => i.attr1 === activeFilters.attr1);
            if (activeFilters.attr2 && items.some(i => i.attr2 === activeFilters.attr2)) items = items.filter(i => i.attr2 === activeFilters.attr2);
            if (activeFilters.attr3 && items.some(i => i.attr3 === activeFilters.attr3)) items = items.filter(i => i.attr3 === activeFilters.attr3);
            if (activeFilters.attr4 && items.some(i => i.attr4 === activeFilters.attr4)) items = items.filter(i => i.attr4 === activeFilters.attr4);
            if (activeFilters.attr5 && items.some(i => i.attr5 === activeFilters.attr5)) items = items.filter(i => i.attr5 === activeFilters.attr5);
        }
        return items;
    }, [inventory, selectedProductCategory, activeFilters, activeTab, itemSearchQuery]);

    const totalSimplePrice = useMemo(() => {
        return (negotiatedPrice * simpleQuantity) + extraAmount;
    }, [negotiatedPrice, simpleQuantity, extraAmount]);

    // Fix: Define totalManualPrice using useMemo for calculations in the 'Others' tab.
    const totalManualPrice = useMemo(() => {
        return manualPrice * manualQuantity;
    }, [manualPrice, manualQuantity]);

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
            itemName += ` [+ ${label}: ${formatUGX(extraAmount)}]`;
        }

        if (dimNotes.trim()) {
            itemName += ` - ${dimNotes.trim()}`;
        }

        const newItem: SaleItem = {
            itemId: `calc-${stockItem.skuId}-${Date.now()}`,
            name: itemName,
            quantity: dimQuantity,
            price: (negotiatedDimPrice) + (extraAmount / dimQuantity),
        };
        setQuoteItems(prev => [...prev, newItem]);
        setDimQuantity(1);
        setExtraAmount(0);
        setExtraAmountLabel('');
        setDimNotes('');
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
            displayName += ` [+ ${label}: ${formatUGX(extraAmount)}]`;
        }
        
        if (simpleNotes.trim()) {
            displayName += ` - ${simpleNotes.trim()}`;
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
        setSimpleNotes('');
    };

    const handleAddManualToQuote = () => {
        if (!manualItemName.trim()) { addToast("Please enter an item name.", "error"); return; }
        if (manualPrice <= 0) { addToast("Price must be greater than zero.", "error"); return; }
        if (manualQuantity <= 0) { addToast("Quantity must be greater than zero.", "error"); return; }

        let name = manualItemName.trim();
        if (manualNotes.trim()) name += ` - ${manualNotes.trim()}`;

        const newItem: SaleItem = {
            itemId: `manual-${Date.now()}`,
            name: name,
            quantity: manualQuantity,
            price: manualPrice,
        };
        
        setQuoteItems(prev => [...prev, newItem]);
        setManualItemName('');
        setManualPrice(0);
        setManualQuantity(1);
        setManualNotes('');
    };
    
    const handleClearQuote = () => setQuoteItems([]);
    const handleRemoveQuoteItem = (index: number) => setQuoteItems(prev => prev.filter((_, i) => i !== index));

    const handleCreateSaleClick = () => {
        if (quoteItems.length === 0) { addToast("Your quote is empty. Add items to create a sale.", "error"); return; }
        onCreateSale(quoteItems);
        handleClearQuote();
    };

    const totalQuotePrice = useMemo(() => quoteItems.reduce((acc, item) => acc + item.price * item.quantity, 0), [quoteItems]);

    const handlePresetClick = (name: string, size: {width: number; height: number}) => {
        if (isDTF) {
            if (name === 'A4') { setDtfPreset('A4'); setLength(29.7); setLengthUnit('cm'); }
            else if (name === 'A3') { setDtfPreset('A3'); setLength(42.0); setLengthUnit('cm'); }
            else { setDtfPreset(null); setLength(size.height); setLengthUnit('cm'); }
        } else {
             setWidth(size.width); setLength(size.height); setWidthUnit('cm'); setLengthUnit('cm');
        }
    };

    const darkInputClass = "block w-full rounded-2xl border border-gray-200 bg-white text-black shadow-sm focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 sm:text-sm placeholder-gray-400 font-bold px-4 py-3 outline-none transition-all";
    const labelClass = "block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1.5";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="bg-white rounded-[2rem] shadow-sm overflow-hidden h-fit border border-gray-100 p-1">
                <div className="flex overflow-x-auto no-scrollbar bg-gray-50/50 p-2 rounded-[1.8rem] gap-1 mb-2">
                    {CALCULATOR_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 min-w-[110px] py-3.5 px-3 text-[10px] font-black text-center whitespace-nowrap transition-all uppercase tracking-widest rounded-2xl ${activeTab === tab.id ? 'bg-yellow-400 text-gray-900 shadow-md scale-[1.02]' : 'text-gray-400 hover:text-gray-600 hover:bg-white'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-6 space-y-8">
                    {activeTabConfig.type === 'dimension' && (
                        <div className="fade-in space-y-6">
                            <div className={`grid ${isDTF ? 'grid-cols-2' : 'grid-cols-6'} gap-2`}>
                                {visiblePaperSizes.map((name) => (
                                    <button key={name} onClick={() => handlePresetClick(name, PAPER_SIZES[name])} className={`py-2.5 text-[11px] font-black rounded-xl border-2 transition-all hover:scale-105 uppercase tracking-tighter shadow-sm ${PAPER_SIZE_STYLES[name] || 'bg-gray-100 text-gray-700 border-gray-100'}`}>{name}</button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Length</label>
                                    <div className="flex group">
                                        <input type="number" value={length} onChange={e => { setLength(parseFloat(e.target.value) || 0); if (isDTF) setDtfPreset(null); }} className={`rounded-r-none border-r-0 ${darkInputClass}`} />
                                        <select value={lengthUnit} onChange={e => setLengthUnit(e.target.value as Unit)} className="rounded-r-2xl border border-l-0 border-gray-200 bg-gray-50 text-black text-[10px] font-black uppercase focus:border-yellow-400 focus:ring-0 px-3 outline-none">
                                            {Object.keys(CONVERSION_TO_METER).map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>{isDTF ? 'Roll Width' : 'Width'}</label>
                                    {isDTF ? (
                                        <select value={selectedStockItem} onChange={e => { setSelectedStockItem(e.target.value); const itm = stockItems.find(i => i.skuId === e.target.value); if (itm) { setWidth(itm.width * 100); setWidthUnit('cm'); } }} className={darkInputClass}>
                                            <option value="" className="bg-white text-black">Select Roll...</option>
                                            {dtfRollOptions.map(opt => <option key={opt.skuId} value={opt.skuId} className="bg-white text-black">{opt.label}</option>)}
                                        </select>
                                    ) : (
                                        <div className="flex group">
                                            <input type="number" value={width} onChange={e => setWidth(parseFloat(e.target.value) || 0)} className={`rounded-r-none border-r-0 ${darkInputClass}`} />
                                            <select value={widthUnit} onChange={e => setWidthUnit(e.target.value as Unit)} className="rounded-r-2xl border border-l-0 border-gray-200 bg-gray-50 text-black text-[10px] font-black uppercase focus:border-yellow-400 focus:ring-0 px-3 outline-none">
                                                {Object.keys(CONVERSION_TO_METER).map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <UnitConverterDisplay lengthM={lengthInMeters} widthM={widthInMeters} />

                            <div className="space-y-4 pt-4 border-t border-gray-50">
                                {!isDTF && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Material</label>
                                            <select value={selectedStockItem} onChange={e => setSelectedStockItem(e.target.value)} className={darkInputClass}>
                                                <option value="" className="bg-white text-black">-- Select --</option>
                                                {availableStockItems.map(item => <option key={item.skuId} value={item.skuId} className="bg-white text-black">{item.itemName}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelClass}>Pricing Tier</label>
                                            <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)} className={darkInputClass} disabled={!selectedStockItem}>
                                                <option value="" className="bg-white text-black">-- Select --</option>
                                                {tiersForSelectedItem.map(tier => <option key={tier.id} value={tier.id} className="bg-white text-black">{tier.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 p-6 rounded-3xl space-y-6 border border-gray-100">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Negotiated Unit Price (UGX)</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={formatNumberWithCommas(negotiatedDimPrice)} 
                                                onChange={e => setNegotiatedDimPrice(parseCommaString(e.target.value))} 
                                                className={darkInputClass}
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded-lg pointer-events-none">
                                                STD: {formatUGX(rawCalculatedDimPrice).replace(' UGX', '')}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Quantity</label>
                                        <input type="number" min="1" value={dimQuantity} onChange={e => setDimQuantity(parseInt(e.target.value) || 1)} className={darkInputClass} />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelClass}>Extra Fee (Design/Work)</label>
                                            <input type="text" value={formatNumberWithCommas(extraAmount)} onChange={e => setExtraAmount(parseCommaString(e.target.value))} className={darkInputClass} placeholder="0" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Fee Description</label>
                                            <input type="text" value={extraAmountLabel} onChange={e => setExtraAmountLabel(e.target.value)} className={darkInputClass} placeholder="Graphic Work" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Job Narration / Notes</label>
                                        <textarea 
                                            rows={2} 
                                            value={dimNotes} 
                                            onChange={e => setDimNotes(e.target.value)} 
                                            className={`${darkInputClass} resize-none text-xs`}
                                            placeholder="Summarize job details here..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-blue-600 text-white rounded-[2rem] text-center shadow-xl shadow-blue-500/20 relative overflow-hidden group">
                                <BeakerIcon className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12 transition-transform group-hover:scale-110" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Total Job Value</p>
                                <p className="text-5xl font-black tracking-tighter">{formatUGX(totalDimPrice)}</p>
                            </div>
                            
                            <button onClick={handleAddDimToQuote} className="w-full bg-[#1A2232] text-yellow-400 font-black py-5 rounded-[1.8rem] shadow-xl hover:bg-gray-800 transition-all active:scale-95 uppercase tracking-[0.2em] text-[10px] border border-yellow-400/10">
                                Append Item To Scratchpad
                            </button>
                        </div>
                    )}

                    {activeTabConfig.type === 'simple' && (
                        <div className="fade-in space-y-6">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                                    <SearchIcon className="h-5 w-5 text-gray-400 group-focus-within:text-yellow-500 transition-colors" />
                                </div>
                                <input 
                                    type="text" 
                                    value={itemSearchQuery}
                                    onChange={e => { setItemSearchQuery(e.target.value); setSelectedProduct(null); }}
                                    placeholder="Search products by name or specification..." 
                                    className="block w-full rounded-3xl border-2 border-gray-50 bg-gray-50/50 pl-12 pr-4 py-4 text-xs font-black text-black placeholder-gray-400 focus:bg-white focus:border-yellow-400 focus:ring-0 outline-none transition-all uppercase tracking-widest shadow-inner"
                                />
                            </div>

                             <div className="bg-gray-50/50 p-5 rounded-[2rem] border border-gray-50 shadow-inner">
                                <label className={labelClass}>Filter By Module</label>
                                <div className="flex flex-wrap gap-2">
                                    <button 
                                        onClick={() => { setSelectedProductCategory(''); setActiveFilters({}); setSelectedProduct(null); setNegotiatedPrice(0); }}
                                        className={`py-2 px-5 text-[10px] font-black rounded-2xl border-2 transition-all uppercase tracking-tighter ${selectedProductCategory === '' ? 'bg-yellow-400 border-yellow-400 text-gray-900 shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-yellow-200'}`}
                                    >
                                        All Items
                                    </button>
                                    {filteredProductCategories.map(cat => (
                                        <button 
                                            key={cat.id} 
                                            onClick={() => { setSelectedProductCategory(cat.name); setActiveFilters({}); setSelectedProduct(null); setNegotiatedPrice(0); }}
                                            className={`py-2 px-5 text-[10px] font-black rounded-2xl border-2 transition-all uppercase tracking-tighter ${selectedProductCategory === cat.name ? 'bg-yellow-400 border-yellow-400 text-gray-900 shadow-md' : 'bg-white border-gray-100 text-gray-400 hover:border-yellow-200'}`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {(activeConfig || filteredInventory.length > 0) && (
                                <div className="space-y-6 pt-4 border-t border-gray-50 slide-in-up">
                                    {activeConfig && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {[1,2,3,4,5].map(num => {
                                                const label = (activeConfig as any)[`field${num}`];
                                                const options = (activeConfig as any)[`field${num}Options`] as string[];
                                                if (!label) return null;
                                                return (
                                                    <div key={num}>
                                                        <label className="block text-[8px] font-black text-gray-400 uppercase mb-1 ml-1.5">{label}</label>
                                                        <select 
                                                            value={activeFilters[`attr${num}`] || ''} 
                                                            onChange={e => { setActiveFilters(prev => ({ ...prev, [`attr${num}`]: e.target.value })); setSelectedProduct(null); setNegotiatedPrice(0); }}
                                                            className="block w-full rounded-2xl border border-gray-200 bg-white text-black font-black text-[10px] px-3 py-2.5 outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/20"
                                                        >
                                                            <option value="" className="bg-white text-black">-- All {label} --</option>
                                                            {options.map(o => <option key={o} value={o} className="bg-white text-black">{o}</option>)}
                                                        </select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex justify-between items-center mb-3 px-1.5">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Matching Items ({filteredInventory.length})</label>
                                        </div>
                                        <div className="max-h-72 overflow-y-auto space-y-2.5 border-2 border-dashed border-gray-100 p-3 rounded-[2rem] bg-gray-50/20 scrollbar-thin">
                                            {filteredInventory.map(item => (
                                                <button 
                                                    key={item.id} 
                                                    onClick={() => { setSelectedProduct(item); setNegotiatedPrice(item.price); }}
                                                    className={`w-full flex justify-between items-center p-5 rounded-2xl border-2 transition-all ${selectedProduct?.id === item.id ? 'bg-blue-100 border-blue-500 text-blue-900 shadow-lg scale-[1.01]' : 'bg-white border-transparent hover:border-blue-100 text-black shadow-sm'}`}
                                                >
                                                    <div className="text-left">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-black uppercase tracking-tight">{item.name}</p>
                                                            <span className="text-[9px] font-black px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full uppercase">{item.category}</span>
                                                        </div>
                                                        <p className="text-[10px] opacity-70 font-bold text-gray-500 mt-1">{[item.attr1, item.attr2, item.attr3, item.attr4, item.attr5].filter(Boolean).join(' · ')}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-black">{formatUGX(item.price)}</p>
                                                        <p className={`text-[9px] font-black ${item.quantity <= (item.minStockLevel || 5) ? 'text-red-500' : 'text-gray-400'} uppercase`}>Stock: {item.quantity}</p>
                                                    </div>
                                                </button>
                                            ))}
                                            {filteredInventory.length === 0 && <div className="text-center py-20 text-gray-300 font-black italic text-xs uppercase tracking-[0.2em] opacity-50">No Items Found</div>}
                                        </div>
                                    </div>

                                    {selectedProduct && (
                                        <div className="bg-white p-7 rounded-[2.5rem] border-2 border-blue-100 shadow-2xl space-y-6 slide-in-up">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className={labelClass}>Negotiated Unit Price (UGX)</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="text" 
                                                            value={formatNumberWithCommas(negotiatedPrice)} 
                                                            onChange={e => setNegotiatedPrice(parseCommaString(e.target.value))} 
                                                            className={`block w-full rounded-2xl border-2 ${negotiatedPrice < (selectedProduct.minPrice || 0) ? 'border-red-500 focus:border-red-600 focus:ring-red-600' : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500'} bg-white text-black shadow-sm text-sm font-black px-4 py-3 outline-none transition-all`}
                                                        />
                                                        {negotiatedPrice < (selectedProduct.minPrice || 0) && (
                                                            <p className="text-[9px] text-red-600 font-bold mt-2 ml-1 uppercase">Price Floor: {formatUGX(selectedProduct.minPrice || 0)}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={labelClass}>Quantity</label>
                                                    <input type="number" min="1" value={simpleQuantity} onChange={e => setSimpleQuantity(parseInt(e.target.value) || 1)} className={darkInputClass} />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-1">
                                                    <label className={labelClass}>Extra Charges</label>
                                                    <input type="text" value={formatNumberWithCommas(extraAmount)} onChange={e => setExtraAmount(parseCommaString(e.target.value))} className={darkInputClass} placeholder="0" />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className={labelClass}>Charge Label</label>
                                                    <input type="text" value={extraAmountLabel} onChange={e => setExtraAmountLabel(e.target.value)} className={darkInputClass} placeholder="Delivery/etc" />
                                                </div>
                                            </div>

                                            <div>
                                                <label className={labelClass}>Job Narration / Notes</label>
                                                <textarea 
                                                    rows={2} 
                                                    value={simpleNotes} 
                                                    onChange={e => setSimpleNotes(e.target.value)} 
                                                    className={`${darkInputClass} resize-none text-xs`}
                                                    placeholder="Summarize job details here..."
                                                />
                                            </div>

                                            <div className="p-6 bg-blue-600 text-white rounded-[2rem] text-center shadow-xl shadow-blue-500/20">
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Aggregate Total</p>
                                                <p className="text-5xl font-black tracking-tighter">{formatUGX(totalSimplePrice)}</p>
                                            </div>

                                            <button 
                                                onClick={handleAddSimpleToQuote} 
                                                disabled={negotiatedPrice < (selectedProduct.minPrice || 0)}
                                                className="w-full bg-[#1A2232] text-yellow-400 font-black py-5 rounded-[1.8rem] shadow-xl hover:bg-gray-800 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale uppercase tracking-[0.2em] text-[10px] border border-yellow-400/10"
                                            >
                                                Append Item To Scratchpad
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTabConfig.id === 'others' && (
                        <div className="fade-in space-y-6">
                            <h4 className="text-[11px] font-black text-gray-700 uppercase tracking-widest border-l-4 border-yellow-500 pl-4 py-1">Miscellaneous Transaction</h4>
                            <div className="space-y-4">
                                <input type="text" placeholder="Item Name (e.g. Delivery Service)" value={manualItemName} onChange={e => setManualItemName(e.target.value)} className={darkInputClass} />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" placeholder="Price (UGX)" value={formatNumberWithCommas(manualPrice)} onChange={e => setManualPrice(parseCommaString(e.target.value))} className={darkInputClass} />
                                    <input type="number" placeholder="Qty" value={manualQuantity || ''} onChange={e => setManualQuantity(parseFloat(e.target.value) || 0)} className={darkInputClass} />
                                </div>
                                <textarea 
                                    rows={3} 
                                    value={manualNotes} 
                                    onChange={e => setManualNotes(e.target.value)} 
                                    className={`${darkInputClass} resize-none text-xs`}
                                    placeholder="Add any additional narration or notes..."
                                />
                                <div className="p-6 bg-orange-50 border-2 border-dashed border-orange-200 rounded-[2rem] text-center">
                                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-[0.3em] mb-2">Calculated Value</p>
                                    <p className="text-5xl font-black text-orange-800 tracking-tighter">{formatUGX(totalManualPrice)}</p>
                                </div>
                                <button onClick={handleAddManualToQuote} className="w-full bg-orange-600 text-white font-black py-5 rounded-[1.8rem] shadow-xl hover:bg-orange-700 transition-all active:scale-95 uppercase tracking-[0.2em] text-[10px]">Append Custom Item</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SCRATCHPAD UI - No changes requested but kept for context */}
            <div className="bg-white p-7 rounded-[2.5rem] shadow-xl h-fit sticky top-4 border border-gray-100">
                <div className="flex justify-between items-center mb-8 border-b border-gray-50 pb-6">
                    <div className="flex items-center">
                         <div className="bg-yellow-400 p-3 rounded-2xl mr-4 text-[#1A2232] shadow-sm"><DocumentTextIcon className="w-6 h-6" /></div>
                         <h3 className="text-xl font-black text-gray-800 tracking-tight uppercase">Order Scratchpad</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleClearQuote} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors">Wipe</button>
                        <button onClick={handleCreateSaleClick} disabled={quoteItems.length === 0} className="text-xs font-black bg-[#1A2232] text-yellow-400 px-8 py-3 rounded-2xl shadow-xl hover:bg-gray-800 transition-all disabled:opacity-30 disabled:grayscale uppercase tracking-[0.15em]">Post Order</button>
                    </div>
                </div>
                
                <div className="space-y-4">
                    {quoteItems.length === 0 ? (
                        <div className="text-center py-24 bg-gray-50/50 rounded-[2rem] border-4 border-dashed border-gray-100">
                            <DocumentTextIcon className="w-20 h-20 mx-auto mb-6 text-gray-200" />
                            <p className="font-black text-gray-300 text-xs uppercase tracking-[0.25em]">No Items Prepared</p>
                        </div>
                    ) : (
                        <>
                            <div className="max-h-[550px] overflow-y-auto pr-3 space-y-4 scrollbar-thin">
                                {quoteItems.map((item, index) => (
                                    <div key={index} className="flex justify-between items-start p-5 bg-white rounded-3xl border border-gray-100 group hover:border-yellow-200 transition-all shadow-sm hover:shadow-md">
                                        <div className="overflow-hidden flex-1 mr-4">
                                            <p className="font-black text-gray-800 text-[11px] uppercase tracking-tight leading-relaxed">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold mt-1.5 uppercase tracking-tighter">{item.quantity} Unit(s) × {formatUGX(item.price)}</p>
                                        </div>
                                        <div className="flex items-center shrink-0">
                                            <p className="font-black text-gray-900 text-sm mr-5">{formatUGX(item.price * item.quantity)}</p>
                                            <button onClick={() => handleRemoveQuoteItem(index)} className="p-2.5 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                             <div className="pt-8 mt-6 border-t-8 border-double border-gray-50">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.4em] block mb-2 opacity-60">Aggregate Amount</span>
                                        <span className="text-5xl font-black text-blue-900 tracking-tighter leading-none">{formatUGX(totalQuotePrice)}</span>
                                    </div>
                                    <div className="text-right">
                                         <p className="text-[9px] text-gray-300 font-bold uppercase italic tracking-widest">* Provisional Total</p>
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
