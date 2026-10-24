
import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { quotationItems } from './kuyiriba';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import SalesView from './components/SalesView';
import InventoryView from './components/InventoryView';
import ExpensesView from './components/ExpensesView';
import CustomersView from './components/CustomersView';
import MarketingView from './components/MarketingView';
import { migrateCustomerCategories } from './migrateCustomerCategories';
import ReportsView from './components/ReportsView';
import LoginView from './components/LoginView';
import UserManagementView from './components/UserManagementView';
import CalculatorView from './components/CalculatorView';
import SettingsView from './components/SettingsView';
import ToastContainer from './components/Toast';
import { InventoryItem, Sale, Expense, Customer, User, MaterialCategory, StockItem, StockTransaction, PricingTier, SaleItem, ExpenseCategory, ProductCategory, BankingRecord, SystemSettings, Quotation } from './types';
import { createStockService } from './stockService';
import { v4 as uuidv4 } from 'uuid';

// Firebase
import { auth, db, firebaseConfig } from './firebase';
import { initializeApp, deleteApp } from "firebase/app";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, setDoc } from 'firebase/firestore';

// Toast Context
type ToastMessage = { id: string; message: string; type: 'success' | 'error' | 'info'; };
const ToastContext = createContext<{ addToast: (message: string, type: ToastMessage['type']) => void; }>({ addToast: () => { } });
export const useToast = () => useContext(ToastContext);

const App: React.FC = () => {
    const [activeView, setActiveView] = useState('Dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    useEffect(() => {
        const navigateToMarketing = () => {
            if (currentUser?.role === 'admin' && window.location.hash.startsWith('#marketing')) {
                setActiveView('Marketing');
            }
        };
        navigateToMarketing();
        window.addEventListener('hashchange', navigateToMarketing);
        return () => window.removeEventListener('hashchange', navigateToMarketing);
    }, [currentUser?.role]);
    const [appLoading, setAppLoading] = useState(true);
    const [operationLoading, setOperationLoading] = useState(false);
    const saleSaveLock = useRef(false);

    // --- Data State ---
    const [users, setUsers] = useState<User[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [materialCategories, setMaterialCategories] = useState<MaterialCategory[]>([]);
    const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
    const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
    const [bankingRecords, setBankingRecords] = useState<BankingRecord[]>([]);
    const DEFAULT_SETTINGS: SystemSettings = {
        businessName: 'Eko Prints',
        tagline: 'Quality Printing & Design',
        businessEmail: 'info@ekoprints.com',
        businessPhone: '0792832056 / 0703580516',
        businessLocation: 'Masaka City',
        receiptHeader: 'EKO PRINTS',
        receiptFooter: 'Thank you for choosing Eko Prints!\nTerms: Non-returnable once sold.\nOfficial receipt issued on full payment.',
        statementHeader: 'EKO PRINTS',
        statementFooter: 'Thank you for your business!'
    };
    const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [quoteForSale, setQuoteForSale] = useState<SaleItem[]>([]);
    const [quoteNarration, setQuoteNarration] = useState('');
    const [quoteDiscount, setQuoteDiscount] = useState(0);
    const [quoteRules, setQuoteRules] = useState<string[]>([]);
    const [quoteTax, setQuoteTax] = useState(0);
    const [isQuotationMode, setIsQuotationMode] = useState(false);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
        setToasts(prev => [...prev, { id: uuidv4(), message, type }]);
    }, []);

    // --- Data Fetching ---
    const fetchData = useCallback(async (collectionName: string) => {
        const querySnapshot = await getDocs(collection(db, collectionName));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }, []);

    const fetchAllData = useCallback(async () => {
        if (!currentUser) return;
        setOperationLoading(true);
        try {
            if (currentUser.role === 'admin') {
                try {
                    const changed = await migrateCustomerCategories();
                    if (changed !== undefined) addToast(`Customer categories verified in Firebase. ${changed} records updated to PRINTING-PHOTOGRAPHY-BRANDING.`, 'success');
                } catch (error) {
                    addToast(`Customer category update failed: ${error instanceof Error ? error.message : 'Unable to update Firebase'}`, 'error');
                }
            }
            const dataPromises = [
                fetchData('users').then(data => setUsers(data as User[])),
                fetchData('customers').then(data => setCustomers(data as Customer[])),
                fetchData('inventory').then(data => setInventory(data as InventoryItem[])),
                fetchData('productCategories').then(data => setProductCategories(data as ProductCategory[])),
                fetchData('materialCategories').then(data => {
                    const normalized = (data as any[]).map(d => ({ ...d, name: d.name || d.categoryName }));
                    setMaterialCategories(normalized as MaterialCategory[]);
                }),
                fetchData('stockItems').then(data => setStockItems((data as any[]).map(d => ({ ...d, skuId: d.skuId || d.id })))),
                fetchData('stockTransactions').then(data => setStockTransactions((data as any[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))),
                fetchData('pricingTiers').then(data => setPricingTiers(data as any[])),
                fetchData('sales').then(data => setSales((data as Sale[]).filter(s => !s.voidedAt).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))),
                fetchData('expenses').then(data => setExpenses((data as Expense[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))),
                fetchData('expenseCategories').then(data => setExpenseCategories(data as ExpenseCategory[])),
                fetchData('bankingRecords').then(data => setBankingRecords((data as BankingRecord[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))),
                fetchData('quotations').then(data => setQuotations((data as Quotation[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))),
                fetchData('settings').then(data => {
                    if (data && data.length > 0) {
                        setSettings(data[0] as SystemSettings);
                    }
                })
            ];
            await Promise.all(dataPromises);
        } catch (error) {
            console.error("Error fetching data:", error);
            addToast("Failed to load data from the server.", "error");
        } finally {
            setOperationLoading(false);
        }
    }, [currentUser, fetchData, addToast]);

    const refreshInventoryData = useCallback(async () => {
        // Refresh only inventory data; do not trigger unrelated migrations after a receipt.
        const names = ['materialCategories', 'stockItems', 'stockTransactions', 'pricingTiers', 'inventory', 'productCategories'];
        const results = await Promise.all(names.map(name => getDocs(collection(db, name))));
        const rows = results.map(result => result.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id })));
        setMaterialCategories(rows[0].map(row => ({ ...row, name: (row as MaterialCategory).name || (row as { categoryName?: string }).categoryName || '' })) as MaterialCategory[]);
        setStockItems(rows[1].map(row => ({ ...row, skuId: (row as StockItem).skuId || row.id })) as StockItem[]);
        setStockTransactions((rows[2] as StockTransaction[]).sort((a, b) => b.date.localeCompare(a.date)));
        setPricingTiers(rows[3] as PricingTier[]);
        setInventory(rows[4] as InventoryItem[]);
        setProductCategories(rows[5] as ProductCategory[]);
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data() as Omit<User, 'id'>;
                    setCurrentUser({ id: firebaseUser.uid, ...userData });
                    if (userData.role === 'user') setActiveView(userData.isBanker ? 'Dashboard' : 'Sales');
                    else setActiveView(window.location.hash.startsWith('#marketing') ? 'Marketing' : 'Dashboard');
                } else {
                    console.error("User document not found in Firestore!");
                    setCurrentUser(null);
                }
            } else {
                setCurrentUser(null);
            }
            setAppLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (currentUser) {
            fetchAllData();
        }
    }, [currentUser, fetchAllData]);

    // --- Auth Handlers ---
    const handleLogin = async (email: string, password: string): Promise<string | void> => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            if (error.code === 'auth/invalid-login-credentials' || error.code === 'auth/invalid-credential') {
                return 'Invalid email or password. Please check your credentials and try again.';
            }
            console.error("Firebase Auth Error:", error);
            return 'An unexpected error occurred during login. Please try again later.';
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    const runAsyncOperation = useCallback(async <T,>(operation: Promise<T>, successMessage: string): Promise<T | void> => {
        setOperationLoading(true);
        try {
            const result = await operation;
            addToast(successMessage, 'success');
            return result;
        } catch (error: any) {
            console.error("Operation failed:", error);
            addToast("An error occurred. Please try again.", "error");
        } finally {
            setOperationLoading(false);
        }
    }, [addToast]);

    const createDocument = useCallback(async (collectionName: string, data: any, stateSetter: React.Dispatch<any>, successMessage: string) => {
        const operation = async () => {
            const { id, ...cleanData } = data;
            const docRef = await addDoc(collection(db, collectionName), cleanData);
            const newDoc = { ...cleanData, id: docRef.id };
            stateSetter((prev: any[]) => [newDoc, ...prev]);
            return newDoc;
        };
        return runAsyncOperation(operation(), successMessage);
    }, [runAsyncOperation]);

    const updateDocument = useCallback(async (collectionName: string, id: string, data: any, stateSetter: React.Dispatch<any>, successMessage: string) => {
        const operation = setDoc(doc(db, collectionName, id), data, { merge: true }).then(() => {
            stateSetter((prev: any[]) => prev.map(item => item.id === id ? { ...item, ...data } : item));
        });
        return runAsyncOperation<void>(operation, successMessage);
    }, [runAsyncOperation]);

    const deleteDocument = useCallback(async (collectionName: string, id: string, stateSetter: React.Dispatch<any>, successMessage: string) => {
        const operation = deleteDoc(doc(db, collectionName, id)).then(() => {
            stateSetter((prev: any[]) => prev.filter(item => item.id !== id));
        });
        return runAsyncOperation<void>(operation, successMessage);
    }, [runAsyncOperation]);

    const syncComplementarySale = useCallback(async (saleId: string) => {
        const linked = await getDoc(doc(db,'sales',saleId+'--complementary'));
        if(!linked.exists())return;
        const child={...linked.data(),id:linked.id} as Sale;
        setSales(previous=>[...previous.filter(s=>s.id!==child.id),...(!child.voidedAt?[child]:[])]);
        const customer=await getDoc(doc(db,'customers',child.customerId));
        if(customer.exists())setCustomers(previous=>previous.some(c=>c.id===customer.id)?previous:[...previous,{...customer.data(),id:customer.id} as Customer]);
    },[]);

    const handleAddSale = useCallback(async (saleData: Omit<Sale, 'id'>) => {
        if (!currentUser) throw new Error('Sign in before saving a sale.');
        if (saleSaveLock.current) throw new Error('A sale is already being saved.');
        saleSaveLock.current = true;
        setOperationLoading(true);
        try {
            const id = doc(collection(db, 'sales')).id;
            const items = await createStockService(db, currentUser).saveSale(id, saleData);
            setSales(previous => [{ ...saleData, id, items, inventoryVersion: 1 }, ...previous]);
            addToast('Sale saved; stock and COGS recorded.', 'success');
            try { await refreshInventoryData(); await syncComplementarySale(id); } catch { addToast('Sale saved. Reload to refresh stock and complementary work.', 'info'); }
        } catch (error) { addToast(error instanceof Error ? error.message : 'Sale failed.', 'error'); throw error; }
        finally { saleSaveLock.current = false; setOperationLoading(false); }
    }, [currentUser, refreshInventoryData, syncComplementarySale, addToast]);

    const handleAddQuotation = useCallback(async (quoteData: Omit<Quotation, 'id'>) => {
        await createDocument('quotations', {...quoteData,items:quotationItems(quoteData.items)}, setQuotations, 'Quotation created successfully.');
    }, [createDocument]);

    const handleDeleteQuotation = useCallback(async (id: string) => {
        await deleteDocument('quotations', id, setQuotations, 'Quotation deleted.');
    }, [deleteDocument]);

    const handleUpdateQuotation = useCallback(async (quotation: Quotation) => {
        const { id, ...data } = quotation;
        await updateDocument('quotations', id, {...data,items:quotationItems(data.items)}, setQuotations, 'Quotation updated successfully.');
    }, [updateDocument]);

    const handleUpdateSale = useCallback(async (sale: Sale) => {
        if (!currentUser) throw new Error('Sign in before updating a sale.');
        const { id, ...data } = sale;
        try {
            const items = await createStockService(db, currentUser).saveSale(id, data);
            setSales(previous => previous.map(s => s.id === id ? { ...sale, items } : s));
            try { await refreshInventoryData(); await syncComplementarySale(id); } catch { addToast('Updated. Reload to refresh stock and complementary work.', 'info'); }
        } catch (error) { addToast(error instanceof Error ? error.message : 'Update failed.', 'error'); throw error; }
    }, [currentUser, refreshInventoryData, syncComplementarySale, addToast]);

    const handleDeleteSale = useCallback(async (sale: Sale) => {
        if (!currentUser) throw new Error('Sign in before voiding a sale.');
        try {
            await createStockService(db, currentUser).reverseSale(sale.id);
            setSales(previous => previous.filter(s => s.id !== sale.id));
            addToast('Sale voided; unopened stock restored through reversing entries.', 'success');
            try { await refreshInventoryData(); await syncComplementarySale(sale.id); } catch { addToast('Voided. Reload to refresh stock and complementary work.', 'info'); }
        } catch (error) { addToast(error instanceof Error ? error.message : 'Unable to void sale.', 'error'); throw error; }
    }, [currentUser, refreshInventoryData, syncComplementarySale, addToast]);

    const handleStockOut = useCallback(async () => {
        addToast('Use Start in Inventory for materials; services no longer deduct meters.', 'info');
    }, [addToast]);

    const handleAddUser = useCallback(async (userData: Omit<User, 'id'> & { password?: string }) => {
        setOperationLoading(true);
        const secondaryAppName = `SecondaryApp-${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.password || 'password123');
            const uid = userCredential.user.uid;
            const { password, ...userDocData } = userData;
            await setDoc(doc(db, 'users', uid), userDocData);
            const newUser = { id: uid, ...userDocData };
            setUsers(prev => [...prev, newUser]);
            addToast(`User ${userData.username} created successfully.`, 'success');
            await signOut(secondaryAuth);
            deleteApp(secondaryApp);
        } catch (error: any) {
            console.error("Error adding user:", error);
            let msg = "Failed to create user.";
            if (error.code === 'auth/email-already-in-use') msg = "Email is already registered.";
            addToast(msg, 'error');
            deleteApp(secondaryApp);
        } finally {
            setOperationLoading(false);
        }
    }, [addToast]);

    const handleUpdateUser = useCallback(async (updatedUser: User) => {
        const { id, password, ...userDocData } = updatedUser;
        await updateDocument('users', id, userDocData, setUsers, 'User updated successfully.');
    }, [updateDocument]);

    if (appLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div></div>;
    }

    if (!currentUser) {
        return (
            <>
                <LoginView onLogin={handleLogin} />
                <ToastContainer toasts={toasts} setToasts={setToasts} />
            </>
        );
    }

    return (
        <ToastContext.Provider value={{ addToast }}>
            <div className="flex h-screen bg-[#F4F7F9] overflow-hidden">
                <Sidebar activeView={activeView} setActiveView={setActiveView} currentUser={currentUser} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header pageTitle={activeView} currentUser={currentUser} onLogout={handleLogout} onMenuClick={() => setIsSidebarOpen(true)} />
                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F4F7F9] p-4 sm:p-6 lg:p-8">
                        {operationLoading && <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center"><div className="bg-white p-4 rounded-lg shadow-lg flex items-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>Processing...</div></div>}
                        {activeView === 'Sales' && (
                            <SalesView
                                sales={sales} inventory={inventory} customers={customers} currentUser={currentUser} users={users} quoteForSale={quoteForSale} quoteNarration={quoteNarration} quoteDiscount={quoteDiscount} quoteRules={quoteRules} quoteTax={quoteTax} isQuotationMode={isQuotationMode} clearQuote={() => { setQuoteForSale([]); setQuoteNarration(''); setQuoteDiscount(0); setQuoteRules([]); setQuoteTax(0); setIsQuotationMode(false); }}
                                onAddSale={handleAddSale} onDeleteSale={handleDeleteSale} onUpdateSale={handleUpdateSale}
                                onAddCustomer={(customerData) => createDocument('customers', { ...customerData, createdAt: new Date().toISOString() }, setCustomers, 'Customer added.')}
                                stockItems={stockItems} pricingTiers={pricingTiers} onStockOut={handleStockOut}
                                settings={settings} quotations={quotations} onAddQuotation={handleAddQuotation} onDeleteQuotation={handleDeleteQuotation} onUpdateQuotation={handleUpdateQuotation}
                            />
                        )}
                        {activeView === 'Calculator' && (
                            <CalculatorView
                                stockItems={stockItems} pricingTiers={pricingTiers} inventory={inventory} materialCategories={materialCategories} productCategories={productCategories}
                                onCreateSale={(items, narration, discount, rules, isQuotation) => { 
                                    setQuoteForSale(items); 
                                    setQuoteNarration(narration); 
                                    setQuoteDiscount(discount); 
                                    setQuoteRules(rules || []);
                                    setIsQuotationMode(!!isQuotation);
                                    setActiveView('Sales'); 
                                }}
                                onCreateQuotation={handleAddQuotation}
                                settings={settings}
                            />
                        )}
                        {activeView === 'Inventory' && (
                            <InventoryView
                                materialCategories={materialCategories} stockItems={stockItems} stockTransactions={stockTransactions} pricingTiers={pricingTiers}
                                inventory={inventory} productCategories={productCategories}
                                currentUser={currentUser} onRefresh={refreshInventoryData}
                                sales={sales} expenses={expenses}
                                onResellMaterial={item => { setQuoteForSale(previous => [...previous, item]); setIsQuotationMode(false); setActiveView('Sales'); }}
                            />
                        )}
                        {activeView === 'Expenses' && (
                            <ExpensesView
                                expenses={expenses} currentUser={currentUser} users={users} expenseCategories={expenseCategories}
                                onAddExpense={(data) => createDocument('expenses', { ...data, module: data.module || 'Unassigned', expenseType: 'operating', userId: currentUser.id, userName: currentUser.username }, setExpenses, 'Expense added.')}
                                onUpdateExpense={(id, data) => updateDocument('expenses', id, data, setExpenses, 'Expense updated.')}
                                onDeleteExpense={(id) => deleteDocument('expenses', id, setExpenses, 'Expense deleted.')}
                                onAddExpenseCategory={(name) => createDocument('expenseCategories', { name }, setExpenseCategories, 'Category added.')}
                                onUpdateExpenseCategory={(id, name) => updateDocument('expenseCategories', id, { name }, setExpenseCategories, 'Category updated.')}
                                onDeleteExpenseCategory={(id) => deleteDocument('expenseCategories', id, setExpenseCategories, 'Category deleted.')}
                            />
                        )}
                        {activeView === 'Customers' && (
                            <CustomersView
                                customers={customers} sales={sales.filter(s=>!s.internalComplementary)}
                                onImportCustomers={async (rows) => {
                                    if (!rows.length || rows.length > 400) throw new Error('Import between 1 and 400 customers.');
                                    for (const row of rows) {
                                        if (row.data.category && !(settings.customerCategories || []).includes(row.data.category) && row.data.category !== customers.find(c => c.id === row.id)?.category) throw new Error('Add the imported customer category in Settings first: ' + row.data.category);
                                    }
                                    const batch = writeBatch(db);
                                    const imported = rows.map(({ id, data }) => {
                                        const existing = id ? customers.find(c => c.id === id) : undefined;
                                        if (id && !existing) throw new Error('Customer no longer exists. Refresh and review again.');
                                        const ref = id ? doc(db, 'customers', id) : doc(collection(db, 'customers'));
                                        const customer = { ...data, createdAt: existing?.createdAt || new Date().toISOString() };
                                        if (id) batch.update(ref, data);
                                        else batch.set(ref, customer);
                                        return { ...existing, ...customer, id: ref.id };
                                    });
                                    await batch.commit();
                                    setCustomers(previous => [...imported, ...previous.filter(c => !imported.some(item => item.id === c.id))]);
                                }}
                                onAddCustomer={(data) => createDocument('customers', { ...data, createdAt: new Date().toISOString() }, setCustomers, 'Customer added.')}
                                onUpdateCustomer={(id, data) => updateDocument('customers', id, data, setCustomers, 'Customer updated.')}
                                onDeleteCustomer={(id) => deleteDocument('customers', id, setCustomers, 'Customer deleted.')}
                                settings={settings}
                            />
                        )}
                        {activeView === 'Dashboard' && (currentUser.role === 'admin' || currentUser.isBanker) && (
                            <ReportsView
                                stockTransactions={stockTransactions}
                                sales={sales}
                                expenses={expenses}
                                inventory={inventory}
                                stockItems={stockItems}
                                materialCategories={materialCategories}
                                currentUser={currentUser}
                                bankingRecords={bankingRecords}
                                customers={customers}
                                onAddBankingRecord={(amount) => {
                                    const record: Omit<BankingRecord, 'id'> = {
                                        date: new Date().toISOString(),
                                        amount,
                                        userId: currentUser.id,
                                        userName: currentUser.username
                                    };
                                    createDocument('bankingRecords', record, setBankingRecords, 'Banking record added.');
                                }}
                                settings={settings}
                            />
                        )}
                        {activeView === 'Marketing' && currentUser.role === 'admin' && <MarketingView customers={customers} />}
                        {activeView === 'Users' && currentUser.role === 'admin' && (
                            <UserManagementView users={users} currentUser={currentUser} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} />
                        )}
                        {activeView === 'Settings' && currentUser.role === 'admin' && (
                            <SettingsView
                                settings={settings}
                                onUpdateSettings={async (newSettings) => {
                                    const settingsCollection = collection(db, 'settings');
                                    const q = query(settingsCollection);
                                    const querySnapshot = await getDocs(q);

                                    if (querySnapshot.empty) {
                                        await createDocument('settings', newSettings, (set) => {
                                            if (typeof set === 'function') {
                                                const dummyPrev: any[] = [];
                                                const result = set(dummyPrev);
                                                if (result && result.length > 0) setSettings(result[0]);
                                            }
                                        }, 'Settings initialized.');
                                    } else {
                                        const docId = querySnapshot.docs[0].id;
                                        await updateDocument('settings', docId, newSettings, (set) => {
                                            setSettings(newSettings);
                                        }, 'System settings updated.');
                                    }
                                }}
                                expenseCategories={expenseCategories}
                                onAddExpenseCategory={(name) => createDocument('expenseCategories', { name }, setExpenseCategories, 'Category added.')}
                                onUpdateExpenseCategory={(id, name) => updateDocument('expenseCategories', id, { name }, setExpenseCategories, 'Category updated.')}
                                onDeleteExpenseCategory={(id) => deleteDocument('expenseCategories', id, setExpenseCategories, 'Category deleted.')}
                            />
                        )}
                    </main>
                </div>
                <ToastContainer toasts={toasts} setToasts={setToasts} />
            </div>
        </ToastContext.Provider>
    );
};

export default App;
