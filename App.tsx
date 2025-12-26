import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import SalesView from './components/SalesView';
import InventoryView from './components/InventoryView';
import ExpensesView from './components/ExpensesView';
import CustomersView from './components/CustomersView';
import ReportsView from './components/ReportsView';
import LoginView from './components/LoginView';
import UserManagementView from './components/UserManagementView';
import CalculatorView from './components/CalculatorView';
import ToastContainer from './components/Toast';
import { InventoryItem, Sale, Expense, Customer, User, MaterialCategory, StockItem, StockTransaction, PricingTier, SaleItem, ExpenseCategory, ProductCategory } from './types';
import { v4 as uuidv4 } from 'uuid';

// Firebase
import { auth, db, firebaseConfig } from './firebase';
import { initializeApp, deleteApp } from "firebase/app";
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, where, setDoc } from 'firebase/firestore';

// Toast Context
type ToastMessage = { id: string; message: string; type: 'success' | 'error' | 'info'; };
const ToastContext = createContext<{ addToast: (message: string, type: ToastMessage['type']) => void; }>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

const App: React.FC = () => {
    const [activeView, setActiveView] = useState('Dashboard');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [appLoading, setAppLoading] = useState(true);
    const [operationLoading, setOperationLoading] = useState(false);
    
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
    const [quoteForSale, setQuoteForSale] = useState<SaleItem[]>([]);
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
            const dataPromises = [
                fetchData('users').then(data => setUsers(data as User[])),
                fetchData('customers').then(data => setCustomers(data as Customer[])),
                fetchData('inventory').then(data => setInventory(data as InventoryItem[])),
                fetchData('productCategories').then(data => setProductCategories(data as ProductCategory[])),
                fetchData('materialCategories').then(data => {
                    const normalized = (data as any[]).map(d => ({ ...d, name: d.name || d.categoryName }));
                    setMaterialCategories(normalized as MaterialCategory[]);
                }),
                fetchData('stockItems').then(data => setStockItems((data as any[]).map(d => ({...d, skuId: d.skuId || d.id})))),
                fetchData('stockTransactions').then(data => setStockTransactions((data as any[]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()))),
                fetchData('pricingTiers').then(data => setPricingTiers(data as any[])),
                fetchData('sales').then(data => setSales((data as Sale[]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()))),
                fetchData('expenses').then(data => setExpenses((data as Expense[]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()))),
                fetchData('expenseCategories').then(data => setExpenseCategories(data as ExpenseCategory[]))
            ];
            await Promise.all(dataPromises);
        } catch (error) {
            console.error("Error fetching data:", error);
            addToast("Failed to load data from the server.", "error");
        } finally {
            setOperationLoading(false);
        }
    }, [currentUser, fetchData, addToast]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data() as Omit<User, 'id'>;
                    setCurrentUser({ id: firebaseUser.uid, ...userData });
                    if (userData.role === 'user') setActiveView('Sales');
                    else setActiveView('Dashboard');
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
            const docRef = await addDoc(collection(db, collectionName), data);
            const newDoc = { id: docRef.id, ...data };
            stateSetter((prev: any[]) => [newDoc, ...prev]);
            return newDoc;
        };
        return runAsyncOperation(operation(), successMessage);
    }, [runAsyncOperation]);

    const updateDocument = useCallback(async (collectionName: string, id: string, data: any, stateSetter: React.Dispatch<any>, successMessage: string) => {
        const operation = updateDoc(doc(db, collectionName, id), data).then(() => {
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

    const handleAddSale = useCallback(async (saleData: Omit<Sale, 'id'>) => {
        const result = await createDocument('sales', saleData, setSales, 'Sale created successfully.');
        if (result) {
            for (const item of saleData.items) {
                let trueId = item.itemId;
                if (trueId.startsWith('simple-')) {
                    trueId = trueId.split('-')[1];
                }
                const invItem = inventory.find(i => i.id === trueId);
                if (invItem) {
                    const newQty = invItem.quantity - item.quantity;
                    await updateDocument('inventory', invItem.id, { quantity: newQty }, setInventory, `Stock updated for ${item.name}`);
                }
            }
        }
    }, [inventory, createDocument, updateDocument]);

    const handleUpdateSale = useCallback(async (sale: Sale) => {
        const { id, ...data } = sale;
        await updateDocument('sales', id, data, setSales, 'Sale updated successfully.');
    }, [updateDocument]);

    const handleStockOut = useCallback(async (skuId: string, metersUsed: number, jobId: string, notes: string) => {
        const stockItem = stockItems.find(i => i.skuId === skuId);
        if (!stockItem) return;
        const transaction = {
            transactionId: uuidv4(),
            skuId,
            transactionType: 'Stock-Out' as const,
            quantityMeters: metersUsed,
            date: new Date().toISOString(),
            jobId,
            notes
        };
        await createDocument('stockTransactions', transaction, setStockTransactions, 'Usage recorded.');
        await updateDocument('stockItems', skuId, { totalStockMeters: stockItem.totalStockMeters - metersUsed }, setStockItems, 'Stock level updated.');
    }, [stockItems, createDocument, updateDocument]);

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
                <Sidebar activeView={activeView} setActiveView={setActiveView} currentUser={currentUser} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <Header pageTitle={activeView} currentUser={currentUser} onLogout={handleLogout} />
                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F4F7F9] p-4 sm:p-6 lg:p-8">
                        {operationLoading && <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center"><div className="bg-white p-4 rounded-lg shadow-lg flex items-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>Processing...</div></div>}
                        {activeView === 'Dashboard' && <DashboardView sales={sales} expenses={expenses} stockItems={stockItems} currentUser={currentUser} onStockOut={handleStockOut} onUpdateSale={handleUpdateSale} />}
                        {activeView === 'Sales' && (
                            <SalesView 
                                sales={sales} inventory={inventory} customers={customers} currentUser={currentUser} users={users} quoteForSale={quoteForSale} clearQuote={() => setQuoteForSale([])}
                                onAddSale={handleAddSale} onDeleteSale={(sale) => deleteDocument('sales', sale.id, setSales, 'Sale deleted.')} onUpdateSale={handleUpdateSale}
                                onAddCustomer={(customerData) => createDocument('customers', { ...customerData, createdAt: new Date().toISOString() }, setCustomers, 'Customer added.')}
                                stockItems={stockItems} pricingTiers={pricingTiers} onStockOut={handleStockOut}
                            />
                        )}
                        {activeView === 'Calculator' && (
                            <CalculatorView 
                                stockItems={stockItems} pricingTiers={pricingTiers} inventory={inventory} materialCategories={materialCategories} productCategories={productCategories}
                                onCreateSale={(items) => { setQuoteForSale(items); setActiveView('Sales'); }}
                            />
                        )}
                        {activeView === 'Inventory' && (
                            <InventoryView 
                                materialCategories={materialCategories} stockItems={stockItems} stockTransactions={stockTransactions} pricingTiers={pricingTiers}
                                onStockIn={async (skuId, rolls, price, notes) => {
                                    const stockItem = stockItems.find(i => i.skuId === skuId);
                                    if (!stockItem) return;
                                    const metersToAdd = rolls * 50;
                                    const transaction = { transactionId: uuidv4(), skuId, transactionType: 'Stock-In' as const, quantityMeters: metersToAdd, date: new Date().toISOString(), jobId: 'STOCK-IN', notes };
                                    await createDocument('stockTransactions', transaction, setStockTransactions, 'Transaction recorded.');
                                    await updateDocument('stockItems', skuId, { totalStockMeters: stockItem.totalStockMeters + metersToAdd, lastPurchasePricePerRoll_UGX: price }, setStockItems, 'Stock level updated.');
                                }}
                                onStockOut={handleStockOut}
                                onAddCategory={(name) => createDocument('materialCategories', { name, isActive: true }, setMaterialCategories, 'Category created.')}
                                onUpdateCategory={(id, name) => updateDocument('materialCategories', id, { name }, setMaterialCategories, 'Category updated.')}
                                onToggleCategoryStatus={(id, currentStatus) => updateDocument('materialCategories', id, { isActive: !currentStatus }, setMaterialCategories, 'Status updated.')}
                                onDeleteCategory={(cat) => deleteDocument('materialCategories', cat.id, setMaterialCategories, 'Category deleted.')}
                                onAddStockItem={(categoryId, width, reorderLevel, itemName) => createDocument('stockItems', { categoryId, width, reorderLevel, itemName, totalStockMeters: 0, lastPurchasePricePerRoll_UGX: 0 }, setStockItems, 'SKU created.')}
                                onUpdateStockItem={(id, reorderLevel) => updateDocument('stockItems', id, { reorderLevel }, setStockItems, 'SKU updated.')}
                                onDeleteStockItem={(id) => deleteDocument('stockItems', id, setStockItems, 'SKU deleted.')}
                                onAddTier={(name, value, categoryId) => createDocument('pricingTiers', { name, value, categoryId }, setPricingTiers, 'Tier created.')}
                                onUpdateTier={(id, name, value) => updateDocument('pricingTiers', id, { name, value }, setPricingTiers, 'Tier updated.')}
                                onDeleteTier={(id) => deleteDocument('pricingTiers', id, setPricingTiers, 'Tier deleted.')}
                                inventory={inventory}
                                onAddInventoryItem={(item) => createDocument('inventory', item, setInventory, 'Product created.')}
                                onUpdateInventoryItem={(id, item) => updateDocument('inventory', id, item, setInventory, 'Product updated.')}
                                onDeleteInventoryItem={(id) => deleteDocument('inventory', id, setInventory, 'Product deleted.')}
                                productCategories={productCategories}
                                onAddProductCategory={(cat) => createDocument('productCategories', cat, setProductCategories, 'Product setup added.')}
                                onUpdateProductCategory={(id, cat) => updateDocument('productCategories', id, cat, setProductCategories, 'Product setup updated.')}
                                onDeleteProductCategory={(id) => deleteDocument('productCategories', id, setProductCategories, 'Product setup deleted.')}
                            />
                        )}
                        {activeView === 'Expenses' && (
                            <ExpensesView 
                                expenses={expenses} currentUser={currentUser} users={users} expenseCategories={expenseCategories}
                                onAddExpense={(data) => createDocument('expenses', { ...data, userId: currentUser.id, userName: currentUser.username }, setExpenses, 'Expense added.')}
                                onUpdateExpense={(id, data) => updateDocument('expenses', id, data, setExpenses, 'Expense updated.')}
                                onDeleteExpense={(id) => deleteDocument('expenses', id, setExpenses, 'Expense deleted.')}
                                onAddExpenseCategory={(name) => createDocument('expenseCategories', { name }, setExpenseCategories, 'Category added.')}
                                onUpdateExpenseCategory={(id, name) => updateDocument('expenseCategories', id, { name }, setExpenseCategories, 'Category updated.')}
                                onDeleteExpenseCategory={(id) => deleteDocument('expenseCategories', id, setExpenseCategories, 'Category deleted.')}
                            />
                        )}
                        {activeView === 'Customers' && (
                            <CustomersView 
                                customers={customers} sales={sales}
                                onAddCustomer={(data) => createDocument('customers', { ...data, createdAt: new Date().toISOString() }, setCustomers, 'Customer added.')}
                                onUpdateCustomer={(id, data) => updateDocument('customers', id, data, setCustomers, 'Customer updated.')}
                                onDeleteCustomer={(id) => deleteDocument('customers', id, setCustomers, 'Customer deleted.')}
                            />
                        )}
                        {activeView === 'Reports' && <ReportsView sales={sales} expenses={expenses} inventory={inventory} stockItems={stockItems} currentUser={currentUser}/>}
                        {activeView === 'Users' && currentUser.role === 'admin' && (
                            <UserManagementView users={users} currentUser={currentUser} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} />
                        )}
                    </main>
                </div>
                <ToastContainer toasts={toasts} setToasts={setToasts} />
            </div>
        </ToastContext.Provider>
    );
};

export default App;