
import React, { useState, useMemo, useEffect } from 'react';
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


const ExpensesView: React.FC<ExpensesViewProps> = (props) => {
  const { expenses, currentUser, users, expenseCategories, onAddExpense, onUpdateExpense, onDeleteExpense } = props;
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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 13;

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

  useEffect(() => { setCurrentPage(1); }, [filterUser, filterCategory, filterDateStart, filterDateEnd]);

  const totalPages = Math.ceil(displayedExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayedExpenses.slice(start, start + ITEMS_PER_PAGE);
  }, [displayedExpenses, currentPage]);

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
  
  const darkInput = "mt-1 block w-full rounded-xl border-none bg-gray-800 p-3 text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-500";
  const labelStyle = "block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1";

  return (
    <div className="space-y-6">
            {/* Single combined header + filters row */}
            <div className="bg-white px-4 py-3 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
                    <h2 className="text-xs font-black text-gray-900 uppercase tracking-tight shrink-0 whitespace-nowrap mr-1">
                        Business Expenses
                    </h2>
                    <div className="w-px h-5 bg-gray-200 shrink-0 hidden lg:block" />

                    {currentUser.role === 'admin' && (
                        <>
                            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                                className="flex-1 min-w-[100px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold text-gray-700 focus:ring-2 focus:ring-yellow-400 outline-none">
                                <option value="">All Staff</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                            </select>
                            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                                className="flex-1 min-w-[110px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold text-gray-700 focus:ring-2 focus:ring-yellow-400 outline-none">
                                <option value="">All Categories</option>
                                {expenseCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                            </select>
                            <input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)}
                                className="flex-1 min-w-[110px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold text-gray-700 focus:ring-2 focus:ring-yellow-400 outline-none" />
                            <span className="text-gray-300 font-black text-xs shrink-0">–</span>
                            <input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)}
                                className="flex-1 min-w-[110px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold text-gray-700 focus:ring-2 focus:ring-yellow-400 outline-none" />
                            <button onClick={handleExportCSV}
                                className="shrink-0 flex items-center px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 whitespace-nowrap">
                                <DocumentTextIcon className="w-3.5 h-3.5 mr-1" /> CSV
                            </button>
                            <button onClick={handleExportPDF}
                                className="shrink-0 flex items-center px-3 py-2 bg-rose-50 text-rose-700 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100 whitespace-nowrap">
                                <PrintIcon className="w-3.5 h-3.5 mr-1" /> PDF
                            </button>
                        </>
                    )}

                    <button onClick={() => setIsAddModalOpen(true)}
                        className="shrink-0 bg-yellow-500 text-[#1A2232] px-5 py-2 rounded-xl font-black flex items-center shadow-md hover:bg-yellow-600 transition-all active:scale-95 uppercase tracking-widest text-[10px] border border-yellow-600/10 whitespace-nowrap ml-auto">
                        <PlusIcon className="w-4 h-4 mr-1.5" /> Add Expense
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-50">
                <table className="w-full text-left table-fixed">
                    <thead className="text-[9px] text-gray-400 uppercase bg-gray-50/50 font-black tracking-widest">
                        <tr>
                            <th className="px-4 py-3 w-[12%]">Date</th>
                            {currentUser.role === 'admin' && <th className="px-4 py-3 w-[13%]">Staff</th>}
                            <th className={`px-4 py-3 ${currentUser.role === 'admin' ? 'w-[16%]' : 'w-[20%]'}`}>Category</th>
                            <th className="px-4 py-3">Narration</th>
                            <th className="px-4 py-3 w-[15%] text-right">Amount</th>
                            {currentUser.role === 'admin' && <th className="px-4 py-3 w-[10%]">Actions</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {paginatedExpenses.map((expense, index) => (
                            <tr key={expense.id} className="bg-white hover:bg-gray-50 transition-colors group" style={{ animationDelay: `${index * 20}ms` }}>
                                <td className="px-4 py-2 font-medium text-gray-600 text-[10px]">
                                    {new Date(expense.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' })}
                                </td>
                                {currentUser.role === 'admin' && (
                                    <td className="px-4 py-2 font-bold text-blue-600 text-[10px] truncate">{expense.userName}</td>
                                )}
                                <td className="px-4 py-2">
                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase truncate block w-fit max-w-full">{expense.category}</span>
                                </td>
                                <td className="px-4 py-2 font-medium text-gray-900 text-[10px] truncate">{expense.description}</td>
                                <td className="px-4 py-2 text-right font-bold text-gray-900 text-[10px]">{formatUGX(expense.amount)}</td>
                                {currentUser.role === 'admin' && (
                                    <td className="px-4 py-2">
                                        <div className="flex items-center justify-start gap-1">
                                            <button onClick={() => handleOpenEditModal(expense)} title="Edit"
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-all active:scale-90">
                                                <EditIcon className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDeleteClick(expense)} title="Delete"
                                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90">
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {displayedExpenses.length === 0 && (
                            <tr>
                                <td colSpan={currentUser.role === 'admin' ? 6 : 4} className="text-center py-16 text-gray-300 font-black uppercase tracking-[0.4em] text-[10px]">
                                    No expenditure records found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination Controls */}
                {displayedExpenses.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-50">
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, displayedExpenses.length)} of {displayedExpenses.length} records
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-black text-sm">‹</button>
                                {(() => {
                                    const pages: number[] = [];
                                    const maxVisible = 5;
                                    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                                    let end = Math.min(totalPages, start + maxVisible - 1);
                                    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
                                    for (let i = start; i <= end; i++) pages.push(i);
                                    return pages.map(page => (
                                        <button key={page} onClick={() => setCurrentPage(page)}
                                            className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${currentPage === page ? 'bg-[#1A2232] text-yellow-400 shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                                            {page}
                                        </button>
                                    ));
                                })()}
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-black text-sm">›</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

      {/* Add New Expense Modal - High Contrast Dark Inputs */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="New Disbursement Entry">
        <form onSubmit={handleAddExpense} className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
               <div className="space-y-1.5">
                  <label className={labelStyle}>Date of Occurrence</label>
                  <input type="date" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} className={darkInput} required />
              </div>
              <div className="space-y-1.5">
                  <label className={labelStyle}>Cost Center (Category)</label>
                  <input type="text" list="expense-categories" value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })} className={darkInput} placeholder="e.g. Supplies, Rent" required />
                  <datalist id="expense-categories">
                      {expenseCategories.map(cat => <option key={cat.id} value={cat.name} />)}
                  </datalist>
              </div>
              <div className="md:col-span-2 space-y-1.5">
                  <label className={labelStyle}>Item/Service Description</label>
                  <input type="text" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} className={darkInput} required placeholder="Detail the expenditure..." />
              </div>
              <div className="space-y-1.5">
                  <label className={labelStyle}>Amount Cleared (UGX)</label>
                  <input type="number" step="1" value={newExpense.amount || ''} onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} className={`${darkInput} text-xl text-yellow-400`} required placeholder="0" />
              </div>
           </div>
          <div className="pt-4">
            <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all hover:bg-blue-700 border border-blue-500/20">Add Expense to Master Log</button>
          </div>
        </form>
      </Modal>

      {editingExpense && (
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Correct Transaction">
            <form onSubmit={handleUpdateExpense} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                        <label className={labelStyle}>Effective Date</label>
                        <input type="date" value={editingExpense.date.split('T')[0]} onChange={e => setEditingExpense({ ...editingExpense, date: e.target.value })} className={darkInput} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className={labelStyle}>Classification</label>
                        <input type="text" list="expense-categories" value={editingExpense.category} onChange={e => setEditingExpense({ ...editingExpense, category: e.target.value })} className={darkInput} required />
                        <datalist id="expense-categories">
                            {expenseCategories.map(cat => <option key={cat.id} value={cat.name} />)}
                        </datalist>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <label className={labelStyle}>Narration Detail</label>
                        <input type="text" value={editingExpense.description} onChange={e => setEditingExpense({ ...editingExpense, description: e.target.value })} className={darkInput} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className={labelStyle}>Value Corrected (UGX)</label>
                        <input type="number" step="1" value={editingExpense.amount} onChange={e => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })} className={`${darkInput} text-xl text-yellow-400`} required />
                    </div>
                </div>
                <div className="pt-4">
                    <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all border border-yellow-400/20">Authorize Change</button>
                </div>
            </form>
        </Modal>
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmDelete}
        title="Security Authorization"
        message={`This operation will permanently purge the expenditure record for "${expenseToDelete?.description}". Proceed with deletion?`}
      />
    </div>
  );
};

export default ExpensesView;
