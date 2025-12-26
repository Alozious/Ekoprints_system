import React, { useState, useMemo } from 'react';
import { Expense, User, ExpenseCategory } from '../types';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import { PlusIcon, EditIcon, TrashIcon, DocumentTextIcon, PrintIcon } from './icons';
import { useToast } from '../App';

interface ExpensesViewProps {
  expenses: Expense[];
  currentUser: User;
  users: User[];
  expenseCategories: ExpenseCategory[];
  onAddExpense: (expenseData: Omit<Expense, 'id' | 'userId' | 'userName'>) => Promise<void>;
  onUpdateExpense: (id: string, expenseData: Omit<Expense, 'id' | 'userId' | 'userName'>) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onAddExpenseCategory: (name: string) => Promise<any>;
  onUpdateExpenseCategory: (id: string, name: string) => Promise<any>;
  onDeleteExpenseCategory: (id: string) => Promise<any>;
}

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

const CategoryManager: React.FC<Pick<ExpensesViewProps, 'expenseCategories' | 'onAddExpenseCategory' | 'onUpdateExpenseCategory' | 'onDeleteExpenseCategory'>> = 
({ expenseCategories, onAddExpenseCategory, onUpdateExpenseCategory, onDeleteExpenseCategory }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        await onAddExpenseCategory(newCategoryName);
        setNewCategoryName('');
        setIsAddModalOpen(false);
    }
    
    const handleOpenEdit = (category: ExpenseCategory) => {
        setEditingCategory(category);
        setIsEditModalOpen(true);
    }

    const handleUpdateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCategory) {
            await onUpdateExpenseCategory(editingCategory.id, editingCategory.name);
            setIsEditModalOpen(false);
            setEditingCategory(null);
        }
    }

    const handleDeleteClick = (category: ExpenseCategory) => {
        setCategoryToDelete(category);
        setIsConfirmModalOpen(true);
    };

    const confirmDelete = () => {
        if(categoryToDelete) {
            onDeleteExpenseCategory(categoryToDelete.id);
            setCategoryToDelete(null);
        }
    };
    
    return (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-2xl mx-auto">
             <div className="p-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-700">Manage Expense Categories</h3>
                 <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-blue-100 text-blue-600 px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-blue-200"><PlusIcon className="w-4 h-4 mr-1"/> Add Category</button>
            </div>
            <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left text-gray-500">
                     <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                             <th className="px-4 py-3">Category Name</th>
                             <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                     </thead>
                    <tbody>
                        {expenseCategories.map(cat => (
                           <tr key={cat.id} className="border-b">
                               <td className="px-4 py-3 font-medium text-gray-800">{cat.name}</td>
                               <td className="px-4 py-3 text-right">
                                   <div className="flex items-center justify-end space-x-3">
                                       <button onClick={() => handleOpenEdit(cat)} className="text-blue-600 hover:text-blue-800"><EditIcon className="w-4 h-4" /></button>
                                       <button onClick={() => handleDeleteClick(cat)} className="text-red-600 hover:text-red-800"><TrashIcon className="w-4 h-4" /></button>
                                   </div>
                               </td>
                           </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Expense Category">
                <form onSubmit={handleAddCategory}>
                    <label className="block text-sm font-medium text-gray-700">Category Name</label>
                    <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required autoFocus />
                    <div className="mt-6 flex justify-end">
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700">Add Category</button>
                    </div>
                </form>
            </Modal>

            {editingCategory && <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Expense Category">
                <form onSubmit={handleUpdateCategory}>
                    <label className="block text-sm font-medium text-gray-700">Category Name</label>
                    <input type="text" value={editingCategory.name} onChange={e => setEditingCategory({...editingCategory, name: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required autoFocus />
                    <div className="mt-6 flex justify-end">
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700">Save Changes</button>
                    </div>
                </form>
            </Modal>}

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={confirmDelete}
                title="Confirm Category Deletion"
                message={`Are you sure you want to delete the category "${categoryToDelete?.name}"? This action cannot be undone if the category is not in use.`}
            />
        </div>
    );
};

const ExpensesView: React.FC<ExpensesViewProps> = (props) => {
  const { expenses, currentUser, users, expenseCategories, onAddExpense, onUpdateExpense, onDeleteExpense } = props;
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const { addToast } = useToast();

  const [newExpense, setNewExpense] = useState<Omit<Expense, 'id' | 'userId' | 'userName'>>({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: 0,
  });

  const [filterUser, setFilterUser] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddExpense(newExpense);
    setNewExpense({ date: new Date().toISOString().split('T')[0], category: '', description: '', amount: 0 });
    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setIsEditModalOpen(true);
  }

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const { id, userId, userName, ...updateData } = editingExpense;
    await onUpdateExpense(id, updateData);
    setIsEditModalOpen(false);
    setEditingExpense(null);
  };
  
  const handleDeleteClick = (expense: Expense) => {
    setExpenseToDelete(expense);
    setIsConfirmModalOpen(true);
  };

  const confirmDelete = () => {
    if (expenseToDelete) {
      onDeleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
    }
  };
  
  const getUsername = (userId: string) => users.find(u => u.id === userId)?.username || 'Unknown User';
  
  const displayedExpenses = useMemo(() => {
    if (currentUser.role === 'admin') {
      return expenses.map(e => ({...e, userName: getUsername(e.userId)}))
        .filter(expense => {
            if (filterUser && expense.userId !== filterUser) return false;
            if (filterCategory && expense.category !== filterCategory) return false;
            if (filterDateStart && new Date(expense.date) < new Date(filterDateStart)) return false;
            if (filterDateEnd && new Date(expense.date) > new Date(filterDateEnd)) return false;
            return true;
        });
    }
    const today = new Date().toDateString();
    return expenses.filter(expense => 
        expense.userId === currentUser.id && new Date(expense.date).toDateString() === today
    );
  }, [expenses, currentUser, users, filterUser, filterCategory, filterDateStart, filterDateEnd]);

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const headers = ["Date", "User", "Category", "Description", "Amount (UGX)"];
    csvContent += headers.join(",") + "\n";

    displayedExpenses.forEach(expense => {
        const row = [
            new Date(expense.date).toLocaleDateString(),
            `"${expense.userName}"`,
            `"${expense.category}"`,
            `"${expense.description.replace(/"/g, '""')}"`,
            expense.amount
        ];
        csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `eko_prints_expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("CSV export started.", "success");
  };

    const handleExportPDF = () => {
        let reportTitle = "Expenses Report";
        let filtersUsed = [
            filterUser ? `User: ${users.find(u=>u.id === filterUser)?.username}` : '',
            filterCategory ? `Category: ${filterCategory}` : '',
            filterDateStart ? `From: ${new Date(filterDateStart).toLocaleDateString()}` : '',
            filterDateEnd ? `To: ${new Date(filterDateEnd).toLocaleDateString()}` : ''
        ].filter(Boolean).join('; ');

        let reportHtml = `
            <div style="font-family: Arial, sans-serif; margin: 20px;">
                <h1 style="text-align: center; color: #333;">${reportTitle}</h1>
                <p style="text-align: center; color: #666;">Generated on: ${new Date().toLocaleDateString()}</p>
                ${filtersUsed ? `<p style="text-align: center; font-size: 0.9em; color: #666;">Filters: ${filtersUsed}</p>` : ''}
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Date</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">User</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Category</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        displayedExpenses.forEach(expense => {
            reportHtml += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; border: 1px solid #ddd;">${new Date(expense.date).toLocaleDateString()}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${expense.userName}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${expense.category}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${expense.description}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatUGX(expense.amount)}</td>
                </tr>
            `;
        });
        
        const total = displayedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        reportHtml += `
            <tr style="background-color: #f2f2f2; font-weight: bold;">
                <td colspan="4" style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total</td>
                <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">${formatUGX(total)}</td>
            </tr>
        `;

        reportHtml += `
                    </tbody>
                </table>
            </div>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Expenses Report</title></head><body>');
            printWindow.document.write(reportHtml);
            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        } else {
            addToast("Could not open print window. Please disable popup blockers.", "error");
        }
    };
  
  const isUserView = currentUser.role === 'user';
  const activeBtnClass = "px-4 py-2 text-sm font-semibold text-yellow-700 bg-yellow-100 border-b-2 border-yellow-500 rounded-t-lg";
  const inactiveBtnClass = "px-4 py-2 text-sm font-medium text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300";

  return (
    <div className="space-y-6">
        {currentUser.role === 'admin' && (
             <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('expenses')} className={activeTab === 'expenses' ? activeBtnClass : inactiveBtnClass}>Expenses</button>
                    <button onClick={() => setActiveTab('categories')} className={activeTab === 'categories' ? activeBtnClass : inactiveBtnClass}>Manage Categories</button>
                </nav>
            </div>
        )}

      {activeTab === 'expenses' && (
        <>
            <div className="flex justify-between items-center">
                <div>
                    {isUserView && <p className="text-gray-500 mt-1">Showing your expenses for today. Entries cannot be edited or deleted.</p>}
                </div>
                <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-md hover:bg-yellow-600 transition-colors font-semibold">
                <PlusIcon className="w-5 h-5 mr-2" /> Add Expense
                </button>
            </div>

            {currentUser.role === 'admin' && (
                <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="lg:col-span-1">
                            <label className="text-sm font-medium text-gray-700 block mb-1">User</label>
                            <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm text-sm">
                                <option value="">All Users</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                            </select>
                        </div>
                        <div className="lg:col-span-1">
                            <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
                            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm text-sm">
                                <option value="">All Categories</option>
                                {expenseCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                            </select>
                        </div>
                        <div className="lg:col-span-1">
                            <label className="text-sm font-medium text-gray-700 block mb-1">From</label>
                            <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm text-sm" />
                        </div>
                        <div className="lg:col-span-1">
                            <label className="text-sm font-medium text-gray-700 block mb-1">To</label>
                            <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm text-sm" />
                        </div>
                        <div className="lg:col-span-1 flex items-end gap-2">
                             <button onClick={handleExportCSV} title="Export as CSV" className="flex items-center justify-center w-full bg-green-100 text-green-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-green-200 transition-colors">
                                <DocumentTextIcon className="w-5 h-5 mr-2" /> CSV
                            </button>
                            <button onClick={handleExportPDF} title="Export as PDF" className="flex items-center justify-center w-full bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors">
                                <PrintIcon className="w-5 h-5 mr-2" /> PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3">Date</th>
                            {currentUser.role === 'admin' && <th scope="col" className="px-6 py-3">User</th>}
                            <th scope="col" className="px-6 py-3">Category</th>
                            <th scope="col" className="px-6 py-3">Description</th>
                            <th scope="col" className="px-6 py-3 text-right">Amount</th>
                            {currentUser.role === 'admin' && <th scope="col" className="px-6 py-3">Actions</th>}
                        </tr>
                        </thead>
                        <tbody>
                        {displayedExpenses.map((expense, index) => (
                            <tr key={expense.id} className="bg-white border-b hover:bg-gray-50 slide-in-up" style={{ animationDelay: `${index * 20}ms` }}>
                                <td className="px-6 py-4">{new Date(expense.date).toLocaleDateString()}</td>
                                {currentUser.role === 'admin' && <td className="px-6 py-4">{expense.userName}</td>}
                                <td className="px-6 py-4">{expense.category}</td>
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{expense.description}</th>
                                <td className="px-6 py-4 text-right font-medium">{formatUGX(expense.amount)}</td>
                                {currentUser.role === 'admin' && (
                                    <td className="px-6 py-4 flex items-center space-x-2">
                                        <button onClick={() => handleOpenEditModal(expense)} className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-100"><EditIcon className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteClick(expense)} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100"><TrashIcon className="w-4 h-4"/></button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {displayedExpenses.length === 0 && (
                            <tr>
                                <td colSpan={currentUser.role === 'admin' ? 6 : 4} className="text-center py-10 text-gray-500">
                                    No expenses recorded {isUserView ? 'for today' : 'matching filters'}.
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
      )}

      {currentUser.role === 'admin' && activeTab === 'categories' && <CategoryManager {...props} />}

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Expense">
        <form onSubmit={handleAddExpense}>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <input type="date" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <input type="text" list="expense-categories" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" placeholder="e.g., Supplies, Rent" required />
                  <datalist id="expense-categories">
                      {expenseCategories.map(cat => <option key={cat.id} value={cat.name} />)}
                  </datalist>
              </div>
              <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <input type="text" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Amount (UGX)</label>
                  <input type="number" step="1" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
              </div>
           </div>
          <div className="mt-6 flex justify-end">
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 transition-colors">Add Expense</button>
          </div>
        </form>
      </Modal>

      {editingExpense && (
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Expense">
            <form onSubmit={handleUpdateExpense}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Date</label>
                        <input type="date" value={editingExpense.date.split('T')[0]} onChange={e => setEditingExpense({ ...editingExpense, date: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Category</label>
                        <input type="text" list="expense-categories" value={editingExpense.category} onChange={e => setEditingExpense({ ...editingExpense, category: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
                        <datalist id="expense-categories">
                            {expenseCategories.map(cat => <option key={cat.id} value={cat.name} />)}
                        </datalist>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <input type="text" value={editingExpense.description} onChange={e => setEditingExpense({ ...editingExpense, description: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Amount (UGX)</label>
                        <input type="number" step="1" value={editingExpense.amount} onChange={e => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 transition-colors">Save Changes</button>
                </div>
            </form>
        </Modal>
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirm Expense Deletion"
        message={`Are you sure you want to delete the expense "${expenseToDelete?.description}" for ${formatUGX(expenseToDelete?.amount || 0)}?`}
      />
    </div>
  );
};

export default ExpensesView;
