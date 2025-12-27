
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
    onCreateSale: (items: SaleItem[], narration: string, discount: number) => void;
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
    'A5': 'bg-rose-100/50 text-rose-700 border-rose-200 hover:bg-rose-200',
    'A4': 'bg-orange-100/50 text-orange-700 border-orange-200 hover:bg-orange-200',
    'A3': 'bg-amber-100/50 text-amber-700 border-amber-200 hover:bg-amber-200',
    'A2': 'bg-emerald-100/50 text-emerald-700 border-emerald-200 hover:bg-emerald-200',
    'A1': 'bg-sky-100/50 text-sky-700 border-sky-200 hover:bg-sky-200',
    'A0': 'bg-violet-100/50 text-violet-700 border-violet-200 hover:bg-violet-200',
};

const CALCULATOR_TABS = [
    { id: 'large-format', label: 'LARGE FORMAT', type: 'dimension' }, 
    { id: 'dtf', label: 'DTF', type: 'dimension' }, 
    { id: 'embroidery', label: 'EMBROIDERY', type: 'simple' },
    { id: 'bizhub', label: 'BIZHUB', type: 'simple' },
    { id: 'supplies', label: 'SUPPLIES', type: 'simple' },
    { id: 'products', label: 'PRODUCTS', type: 'simple' },
    { id: 'others', label: 'OTHERS', type: 'manual' },
];

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
        m: valM.toFixed(3),
        cm: (valM * 100).toFixed(2),
        ft: (valM / CONVERSION_TO_METER.ft).toFixed(2),
        in: (valM / CONVERSION_TO_METER.in).toFixed(2),
    });

    const length = conversions(lengthM);
    const width = conversions(widthM);

    return (
        <div className="grid grid-cols-2 gap-x-8 text-[11px] font-bold py-1 px-1">
            <div className="space-y-1">
                <div className="flex justify-between text-gray-400"><span>L:</span><span className="text-gray-800">{length.ft} ft</span></div>
                <div className="flex justify-between text-gray-400"><span>L:</span><span className="text-gray-800">{length.cm} cm</span></div>
                <div className="flex justify-between text-gray-400 opacity-60"><span>L:</span><span>{length.in} in</span></div>
                <div className="flex justify-between text-gray-400 opacity-60"><span>L:</span><span>{length.m} m</span></div>
            </div>
            <div className="space-y-1">
                <div className="flex justify-between text-gray-400"><span>W:</span><span className="text-gray-800">{width.ft} ft</span></div>
                <div className="flex justify-between text-gray-400"><span>W:</span><span className="text-gray-800">{width.cm} cm</span></div>
                <div className="flex justify-between text-gray-400 opacity-60"><span>W:</span><span>{width.in} in</span></div>
                <div className="flex justify-between text-gray-400 opacity-60"><span>W:</span><span>{width.m} m</span></div>
            </div>
        </div>
    );
};

const CalculatorView: React.FC<CalculatorViewProps> = ({ stockItems, pricingTiers, inventory, materialCategories, productCategories, onCreateSale }) => {
    const [activeTab, setActiveTab] = useState(CALCULATOR_TABS[0].id);
    const [quoteItems, setQuoteItems] = useState<SaleItem[]>([]);
    const [globalNarration, setGlobalNarration] = useState('');
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

    // Others (Manual Entry) State
    const [manualItemName, setManualItemName] = useState('');
    const [manualPrice, setManualPrice] = useState<number>(0);
    const [manualQuantity, setManualQuantity] = useState<number>(1);

    // Discount State
    const [finalPayable, setFinalPayable] = useState<number | null>(null);

    const activeTabConfig = useMemo(() => CALCULATOR_TABS.find(t => t.id === activeTab) || CALCULATOR_TABS[0], [activeTab]);
    const isDTF = activeTab === 'dtf';

    const lengthInMeters = useMemo(() => length * CONVERSION_TO_METER[lengthUnit], [length, lengthUnit]);
    const widthInMeters = useMemo(() => width * CONVERSION_TO_METER[widthUnit], [width, widthUnit]);
    const areaInSqCm = useMemo(() => (lengthInMeters * 100) * (widthInMeters * 100), [lengthInMeters, widthInMeters]);

    const subtotalQuotePrice = useMemo(() => quoteItems.reduce((acc, item) => acc + item.price * item.quantity, 0), [quoteItems]);

    // Handle initial state for finalPayable
    useEffect(() => {
        setFinalPayable(subtotalQuotePrice);
    }, [subtotalQuotePrice]);

    const discountAmount = useMemo(() => {
        if (finalPayable === null) return 0;
        return subtotalQuotePrice - (finalPayable || 0);
    }, [subtotalQuotePrice, finalPayable]);

    const discountPercentage = useMemo(() => {
        if (subtotalQuotePrice === 0) return 0;
        return (discountAmount / subtotalQuotePrice) * 100;
    }, [subtotalQuotePrice, discountAmount]);

    const visiblePaperSizes = useMemo(() => {
        if (isDTF) return ['A4', 'A3'];
        return Object.keys(PAPER_SIZES);
    }, [isDTF]);

    // Dimension Calc Logic - Filtered by strict module field
    const availableStockItems = useMemo(() => {
        return stockItems.filter(item => item.module === activeTab);
    }, [stockItems, activeTab]);

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

    const rawCalculatedDimPrice = useMemo(() => {
        if (isDTF && dtfPreset) {
            if (dtfPreset === 'A4') return 5000;
            if (dtfPreset === 'A3') return 10000;
        }
        // Both Large Format and custom DTF sizes use selected tier multiplier
        return Math.round(areaInSqCm * selectedMultiplier);
    }, [areaInSqCm, selectedMultiplier, isDTF, dtfPreset]);

    useEffect(() => {
        setNegotiatedDimPrice(rawCalculatedDimPrice);
    }, [rawCalculatedDimPrice]);

    useEffect(() => {
        setExtraAmount(0);
        setExtraAmountLabel('');
        setItemSearchQuery('');
        if (activeTabConfig.type === 'simple') {
            setSelectedProductCategory('');
            setActiveFilters({});
            setSelectedProduct(null);
            setSimpleQuantity(1);
            setNegotiatedPrice(0);
        }
    }, [activeTab, activeTabConfig.type]);

    const totalDimPrice = useMemo(() => {
        return (negotiatedDimPrice * dimQuantity) + extraAmount;
    }, [negotiatedDimPrice, dimQuantity, extraAmount]);

    const filteredProductCategories = useMemo(() => {
        return productCategories.filter(cat => cat.module === activeTab);
    }, [productCategories, activeTab]);

    const filteredInventory = useMemo(() => {
        let items = inventory.filter(item => item.module === activeTab);
        
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
        }
        return items;
    }, [inventory, selectedProductCategory, activeTab, itemSearchQuery]);

    const totalSimplePrice = useMemo(() => {
        return (negotiatedPrice * simpleQuantity) + extraAmount;
    }, [negotiatedPrice, simpleQuantity, extraAmount]);

    const handleAddDimToQuote = () => {
        if (!selectedStockItem) { addToast("Please select a material/roll.", "error"); return; }
        // Restored validation for tiers for both Large Format and custom DTF sizes
        if (!dtfPreset && !selectedTier) { addToast("Please select a pricing tier.", "error"); return; }
        if (totalDimPrice <= 0) { addToast("Calculated price must be greater than zero.", "error"); return; }
        
        const stockItem = stockItems.find(i => i.skuId === selectedStockItem);
        if (!stockItem) return;

        let itemName = stockItem.itemName;
        if (isDTF) {
            if (dtfPreset) itemName += ` (${dtfPreset})`;
            else itemName += ` (Custom: ${lengthInMeters.toFixed(2)}m)`;
        } else {
             itemName += ` (${(lengthInMeters).toFixed(2)}m x ${(widthInMeters).toFixed(2)}m)`;
        }

        const newItem: SaleItem = {
            itemId: `calc-${stockItem.skuId}-${Date.now()}`,
            name: itemName,
            quantity: dimQuantity,
            price: (negotiatedDimPrice) + (extraAmount / dimQuantity),
        };
        setQuoteItems(prev => [...prev, newItem]);
        addToast("Added to scratchpad.", "success");
    };

    const handleAddSimpleToQuote = () => {
        if (!selectedProduct) return;
        const newItem: SaleItem = {
            itemId: `simple-${selectedProduct.id}-${Date.now()}`,
            name: `${selectedProduct.name} ${[selectedProduct.attr1, selectedProduct.attr2].filter(Boolean).join(' | ')}`,
            quantity: simpleQuantity,
            price: negotiatedPrice + (extraAmount / simpleQuantity),
        };
        setQuoteItems(prev => [...prev, newItem]);
        addToast("Added to scratchpad.", "success");
    };

    const handleAddManualToQuote = () => {
        if (!manualItemName.trim()) { addToast("Please enter an item name.", "error"); return; }
        if (manualPrice <= 0) { addToast("Price must be greater than zero.", "error"); return; }
        
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
        addToast("Added to scratchpad.", "success");
    };

    const handleClearQuote = () => {
        setQuoteItems([]);
        setGlobalNarration('');
        setFinalPayable(0);
    };

    const handleCreateSaleClick = () => {
        if (quoteItems.length === 0) return;
        onCreateSale(quoteItems, globalNarration, discountAmount);
        handleClearQuote();
    };

    const handleRemoveQuoteItem = (index: number) => setQuoteItems(prev => prev.filter((_, i) => i !== index));

    const handlePresetClick = (name: string, size: {width: number; height: number}) => {
        if (isDTF) {
            if (name === 'A4') { setDtfPreset('A4'); setLength(29.7); setLengthUnit('cm'); }
            else if (name === 'A3') { setDtfPreset('A3'); setLength(42.0); setLengthUnit('cm'); }
        } else {
             setWidth(size.width); setLength(size.height); setWidthUnit('cm'); setLengthUnit('cm');
        }
    };

    const darkInputClass = "block w-full rounded-2xl border border-gray-100 bg-white text-gray-900 shadow-inner focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/10 text-xs placeholder-gray-300 font-bold px-4 py-3 outline-none transition-all";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1.5 ml-1";

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,1fr] gap-6 items-start h-[calc(100vh-140px)] overflow-hidden">
            {/* Left Column: Input Form */}
            <div className="bg-[#F4F7F9] rounded-[2.5rem] shadow-sm overflow-hidden h-full flex flex-col p-4 space-y-4">
                <div className="flex overflow-x-auto no-scrollbar gap-2 shrink-0 px-1">
                    {CALCULATOR_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-2 px-6 text-[10px] font-black whitespace-nowrap transition-all uppercase tracking-widest rounded-full border-2 ${activeTab === tab.id ? 'bg-yellow-400 border-yellow-400 text-gray-900 shadow-md scale-105' : 'bg-white border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex-1 overflow-y-auto no-scrollbar space-y-6">
                    {activeTabConfig.type === 'dimension' && (
                        <div className="fade-in space-y-6">
                            {/* Paper Presets */}
                            <div className="flex flex-wrap gap-2 justify-between">
                                {visiblePaperSizes.map((name) => (
                                    <button 
                                        key={name} 
                                        onClick={() => handlePresetClick(name, PAPER_SIZES[name])} 
                                        className={`flex-1 py-3 text-[11px] font-black rounded-xl border-2 transition-all hover:scale-105 uppercase tracking-widest shadow-sm ${PAPER_SIZE_STYLES[name] || 'bg-gray-100 text-gray-700 border-gray-100'}`}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Length</label>
                                    <div className="relative group">
                                        <input type="number" value={length} onChange={e => { setLength(parseFloat(e.target.value) || 0); if (isDTF) setDtfPreset(null); }} className={`${darkInputClass} pr-16`} />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center h-full">
                                            <select 
                                                value={lengthUnit} 
                                                onChange={e => setLengthUnit(e.target.value as Unit)}
                                                className="bg-transparent border-none focus:ring-0 text-[10px] font-black text-gray-500 uppercase cursor-pointer pr-4"
                                            >
                                                <option value="cm">cm</option>
                                                <option value="m">m</option>
                                                <option value="ft">ft</option>
                                                <option value="in">in</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Width</label>
                                    <div className="relative group">
                                        <input type="number" value={width} onChange={e => setWidth(parseFloat(e.target.value) || 0)} className={`${darkInputClass} pr-16`} />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center h-full">
                                            <select 
                                                value={widthUnit} 
                                                onChange={e => setWidthUnit(e.target.value as Unit)}
                                                className="bg-transparent border-none focus:ring-0 text-[10px] font-black text-gray-500 uppercase cursor-pointer pr-4"
                                            >
                                                <option value="cm">cm</option>
                                                <option value="m">m</option>
                                                <option value="ft">ft</option>
                                                <option value="in">in</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100">
                                <UnitConverterDisplay lengthM={lengthInMeters} widthM={widthInMeters} />
                            </div>

                            <div className="bg-white border-2 border-dashed border-gray-100 rounded-2xl p-4 text-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Calculated Surface Area</span>
                                <p className="text-lg font-black text-gray-700">{(areaInSqCm).toLocaleString()} <span className="text-xs text-gray-400">cm²</span> | {(areaInSqCm / 10000).toFixed(4)} <span className="text-xs text-gray-400">m²</span></p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Material</label>
                                    <div className="relative">
                                        <select value={selectedStockItem} onChange={e => setSelectedStockItem(e.target.value)} className={`${darkInputClass} appearance-none pr-10`}>
                                            <option value="">-- Select --</option>
                                            {availableStockItems.map(item => <option key={item.skuId} value={item.skuId}>{item.itemName}</option>)}
                                        </select>
                                        <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Pricing Tier</label>
                                    <div className="relative">
                                        <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)} className={`${darkInputClass} appearance-none pr-10`} disabled={!selectedStockItem}>
                                            <option value="">-- Select --</option>
                                            {tiersForSelectedItem.map(tier => <option key={tier.id} value={tier.id}>{tier.name}</option>)}
                                        </select>
                                        <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Negotiated Unit Price</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={formatNumberWithCommas(negotiatedDimPrice)} 
                                            onChange={e => setNegotiatedDimPrice(parseCommaString(e.target.value))} 
                                            className={darkInputClass}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-500 bg-blue-50 px-2 py-1 rounded shadow-sm pointer-events-none animate-pulse">
                                            0
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Quantity</label>
                                    <input type="number" min="1" value={dimQuantity} onChange={e => setDimQuantity(parseInt(e.target.value) || 1)} className={darkInputClass} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Extra Fee</label>
                                    <input type="text" value={formatNumberWithCommas(extraAmount)} onChange={e => setExtraAmount(parseCommaString(e.target.value))} className={darkInputClass} placeholder="0" />
                                </div>
                                <div>
                                    <label className={labelClass}>Fee Description</label>
                                    <input type="text" value={extraAmountLabel} onChange={e => setExtraAmountLabel(e.target.value)} className={darkInputClass} placeholder="Graphic Work..." />
                                </div>
                            </div>

                            <div className="p-1 bg-blue-600 rounded-[1.8rem] shadow-xl transform transition-all hover:scale-[1.02]">
                                <div className="bg-blue-600/90 border border-white/20 rounded-[1.6rem] p-6 text-center text-white relative overflow-hidden">
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-2">Total Item Value</p>
                                    <div className="flex items-center justify-center gap-3">
                                        <span className="text-4xl font-black tracking-tighter">{formatNumberWithCommas(totalDimPrice)}</span>
                                        <span className="text-2xl font-black opacity-90">UGX</span>
                                    </div>
                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                                </div>
                            </div>
                            
                            <button onClick={handleAddDimToQuote} className="w-full bg-[#1A2232] text-yellow-400 font-black py-5 rounded-[1.8rem] shadow-2xl hover:bg-gray-800 transition-all active:scale-95 uppercase tracking-[0.25em] text-xs border border-yellow-400/10">
                                Append To Scratchpad
                            </button>
                        </div>
                    )}

                    {activeTabConfig.type === 'simple' && (
                        <div className="fade-in space-y-6">
                            <div className="relative">
                                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input 
                                    type="text" 
                                    value={itemSearchQuery}
                                    onChange={e => setItemSearchQuery(e.target.value)}
                                    placeholder="SEARCH CATALOG..." 
                                    className={`${darkInputClass} pl-12 uppercase tracking-widest`}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Module Filter</label>
                                    <select value={selectedProductCategory} onChange={e => setSelectedProductCategory(e.target.value)} className={darkInputClass}>
                                        <option value="">All Categories</option>
                                        {filteredProductCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Product Selection</label>
                                    <select value={selectedProduct?.id || ''} onChange={e => {
                                        const p = filteredInventory.find(i => i.id === e.target.value);
                                        setSelectedProduct(p || null);
                                        if (p) setNegotiatedPrice(p.price);
                                    }} className={darkInputClass}>
                                        <option value="">Choose Item...</option>
                                        {filteredInventory.map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} ({formatUGX(item.price).replace(' UGX', '')})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {selectedProduct && (
                                <div className="space-y-6 pt-4 border-t border-gray-50">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Negotiated Unit Price</label>
                                            <input 
                                                type="text" 
                                                value={formatNumberWithCommas(negotiatedPrice)} 
                                                onChange={e => setNegotiatedPrice(parseCommaString(e.target.value))} 
                                                className={`${darkInputClass} ${negotiatedPrice < (selectedProduct.minPrice || 0) ? 'border-red-500 text-red-600' : ''}`}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Quantity</label>
                                            <input type="number" min="1" value={simpleQuantity} onChange={e => setSimpleQuantity(parseInt(e.target.value) || 1)} className={darkInputClass} />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Extra Fee</label>
                                            <input type="text" value={formatNumberWithCommas(extraAmount)} onChange={e => setExtraAmount(parseCommaString(e.target.value))} className={darkInputClass} placeholder="0" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Fee Details</label>
                                            <input type="text" value={extraAmountLabel} onChange={e => setExtraAmountLabel(e.target.value)} className={darkInputClass} placeholder="Design etc..." />
                                        </div>
                                    </div>

                                    <div className="p-1 bg-blue-600 rounded-[1.8rem] shadow-xl">
                                        <div className="bg-blue-600 border border-white/20 rounded-[1.6rem] p-6 text-center text-white">
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-2">Aggregate Value</p>
                                            <p className="text-4xl font-black tracking-tighter">{formatNumberWithCommas(totalSimplePrice)} <span className="text-2xl font-black opacity-90">UGX</span></p>
                                        </div>
                                    </div>

                                    <button onClick={handleAddSimpleToQuote} className="w-full bg-[#1A2232] text-yellow-400 font-black py-5 rounded-[1.8rem] shadow-2xl hover:bg-gray-800 transition-all uppercase tracking-[0.25em] text-xs border border-yellow-400/10">
                                        Append To Scratchpad
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTabConfig.type === 'manual' && (
                        <div className="fade-in space-y-6">
                            <div>
                                <label className={labelClass}>Manual Item Designation</label>
                                <input 
                                    type="text" 
                                    value={manualItemName} 
                                    onChange={e => setManualItemName(e.target.value)} 
                                    className={darkInputClass} 
                                    placeholder="e.g. Graphic Design Services" 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Negotiated Unit Price</label>
                                    <input 
                                        type="text" 
                                        value={formatNumberWithCommas(manualPrice)} 
                                        onChange={e => setManualPrice(parseCommaString(e.target.value))} 
                                        className={darkInputClass} 
                                        placeholder="0" 
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Quantity</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={manualQuantity} 
                                        onChange={e => setManualQuantity(parseInt(e.target.value) || 1)} 
                                        className={darkInputClass} 
                                    />
                                </div>
                            </div>

                            <div className="p-1 bg-blue-600 rounded-[1.8rem] shadow-xl transform transition-all hover:scale-[1.02]">
                                <div className="bg-blue-600/90 border border-white/20 rounded-[1.6rem] p-6 text-center text-white relative overflow-hidden">
                                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60 mb-2">Total Item Value</p>
                                    <div className="flex items-center justify-center gap-3">
                                        <span className="text-4xl font-black tracking-tighter">{formatNumberWithCommas(manualPrice * manualQuantity)}</span>
                                        <span className="text-2xl font-black opacity-90">UGX</span>
                                    </div>
                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
                                </div>
                            </div>

                            <button onClick={handleAddManualToQuote} className="w-full bg-[#1A2232] text-yellow-400 font-black py-5 rounded-[1.8rem] shadow-2xl hover:bg-gray-800 transition-all uppercase tracking-[0.25em] text-xs border border-yellow-400/10">
                                Append To Scratchpad
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Order Scratchpad */}
            <div className="bg-white rounded-[2.5rem] shadow-xl h-full border border-gray-100 flex flex-col p-6 overflow-hidden">
                <div className="flex justify-between items-center mb-6 shrink-0 border-b border-gray-50 pb-6">
                    <div className="flex items-center gap-3">
                         <div className="bg-yellow-400 p-3 rounded-2xl text-[#1A2232] shadow-sm"><DocumentTextIcon className="w-5 h-5" /></div>
                         <h3 className="text-sm font-black text-gray-900 tracking-widest uppercase">Order Scratchpad</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleClearQuote} className="text-[10px] font-black text-gray-300 hover:text-red-500 uppercase tracking-widest transition-all">Wipe</button>
                        <button onClick={handleCreateSaleClick} disabled={quoteItems.length === 0} className="text-[11px] font-black bg-[#E2E8F0] text-[#94A3B8] px-8 py-3 rounded-2xl shadow-sm hover:bg-[#1A2232] hover:text-yellow-400 transition-all disabled:opacity-50 uppercase tracking-widest active:scale-95">Post Order</button>
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col overflow-hidden">
                    {quoteItems.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                            <div className="bg-gray-50 p-10 rounded-full mb-6 border-2 border-dashed border-gray-100"><DocumentTextIcon className="w-20 h-20 text-gray-200" /></div>
                            <p className="font-black text-gray-300 text-[11px] uppercase tracking-[0.4em]">No Items Prepared</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin">
                                {quoteItems.map((item, index) => (
                                    <div key={index} className="flex justify-between items-center p-5 bg-gray-50/50 rounded-3xl border border-gray-100 hover:border-yellow-400 hover:bg-white transition-all shadow-sm group">
                                        <div className="overflow-hidden flex-1 mr-6">
                                            <p className="font-black text-gray-900 text-xs uppercase tracking-tight truncate mb-1">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.quantity} x {formatUGX(item.price)}</p>
                                        </div>
                                        <div className="flex items-center shrink-0">
                                            <p className="font-black text-gray-900 text-sm mr-4 tracking-tighter">{formatUGX(item.price * item.quantity)}</p>
                                            <button onClick={() => handleRemoveQuoteItem(index)} className="p-2.5 bg-white text-gray-300 hover:text-red-500 rounded-xl transition-all shadow-sm group-hover:scale-110"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                             
                             <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-100 space-y-6 shrink-0">
                                <div>
                                    <label className={labelClass}>Internal Job Details (Team Only)</label>
                                    <textarea 
                                        rows={2} 
                                        value={globalNarration} 
                                        onChange={e => setGlobalNarration(e.target.value)} 
                                        className="w-full rounded-[1.8rem] border-2 border-gray-50 bg-gray-50 p-5 text-xs font-bold text-gray-900 focus:bg-white focus:border-yellow-400 outline-none resize-none shadow-inner transition-all placeholder-gray-300"
                                        placeholder="Add production notes for internal tracking..."
                                    />
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="bg-[#1A2232] p-6 rounded-[2.2rem] shadow-2xl relative overflow-hidden group">
                                        <div className="relative z-10 flex flex-col">
                                            <div className="flex justify-between items-end mb-2">
                                                <div>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.4em] block mb-1">Payable Total</span>
                                                    <span className="text-3xl font-black text-yellow-400 tracking-tighter leading-none">{formatUGX(finalPayable || subtotalQuotePrice)}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Discount</span>
                                                    <div className="flex items-center justify-end gap-2 mt-1">
                                                        <input 
                                                            type="text"
                                                            value={formatNumberWithCommas(finalPayable === null ? subtotalQuotePrice : (finalPayable || 0))}
                                                            onChange={e => setFinalPayable(parseCommaString(e.target.value))}
                                                            className="bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-xs font-black text-white w-28 text-right focus:bg-white/20 outline-none transition-all"
                                                            placeholder="Final Amt"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            {discountAmount > 0 && (
                                                <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-2">
                                                    <span className="text-[8px] font-black text-rose-300 uppercase tracking-widest">Saving Client: {formatUGX(discountAmount)}</span>
                                                    <span className="text-[8px] font-black text-rose-300 bg-rose-400/20 px-2 py-0.5 rounded-full">{discountPercentage.toFixed(1)}% OFF</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
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
