
import React, { useState, useEffect } from 'react';
import { SystemSettings, ExpenseCategory } from '../types';
import { SaveIcon, PlusIcon, EditIcon, TrashIcon } from './icons';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';

interface SettingsViewProps {
    settings: SystemSettings;
    onUpdateSettings: (settings: SystemSettings) => Promise<void>;
    expenseCategories: ExpenseCategory[];
    onAddExpenseCategory: (name: string) => Promise<any>;
    onUpdateExpenseCategory: (id: string, name: string) => Promise<any>;
    onDeleteExpenseCategory: (id: string) => Promise<any>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings, expenseCategories, onAddExpenseCategory, onUpdateExpenseCategory, onDeleteExpenseCategory }) => {
    const [formData, setFormData] = useState<SystemSettings>(settings);

    // Expense Categories state
    const [isCatAddOpen, setIsCatAddOpen] = useState(false);
    const [isCatEditOpen, setIsCatEditOpen] = useState(false);
    const [isCatDeleteOpen, setIsCatDeleteOpen] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [editingCat, setEditingCat] = useState<ExpenseCategory | null>(null);
    const [deletingCat, setDeletingCat] = useState<ExpenseCategory | null>(null);

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        await onAddExpenseCategory(newCatName.trim());
        setNewCatName('');
        setIsCatAddOpen(false);
    };
    const handleUpdateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCat) return;
        await onUpdateExpenseCategory(editingCat.id, editingCat.name);
        setIsCatEditOpen(false);
        setEditingCat(null);
    };

    useEffect(() => {
        setFormData(settings);
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onUpdateSettings(formData);
    };

    const inputClass = "mt-1 block w-full rounded-xl border-none bg-white p-4 text-sm font-bold text-gray-900 shadow-sm border border-gray-100 focus:ring-2 focus:ring-yellow-400 outline-none transition-all placeholder-gray-400";
    const labelClass = "block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1";

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">System Settings</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-4 border-b pb-2">Business Identity</h3>
                        </div>

                        <div className="md:col-span-2">
                            <label className={labelClass}>Business Registered Name</label>
                            <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} className={inputClass} required />
                        </div>

                        <div className="md:col-span-2">
                            <label className={labelClass}>Business Tagline</label>
                            <input type="text" name="tagline" value={formData.tagline} onChange={handleChange} className={inputClass} placeholder="e.g. Quality Printing & Design" />
                        </div>

                        <div>
                            <label className={labelClass}>Contact Email</label>
                            <input type="email" name="businessEmail" value={formData.businessEmail} onChange={handleChange} className={inputClass} required />
                        </div>

                        <div>
                            <label className={labelClass}>Phone Numbers</label>
                            <input type="text" name="businessPhone" value={formData.businessPhone} onChange={handleChange} className={inputClass} required />
                        </div>

                        <div className="md:col-span-2">
                            <label className={labelClass}>Physical Location</label>
                            <textarea name="businessLocation" value={formData.businessLocation} onChange={handleChange} className={`${inputClass} min-h-[80px] py-3`} required />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-4 border-b pb-2">Receipt & Statement Configuration</h3>
                        </div>

                        <div>
                            <label className={labelClass}>Receipt Header (XPOS & Invoice)</label>
                            <textarea name="receiptHeader" value={formData.receiptHeader} onChange={handleChange} className={`${inputClass} min-h-[80px] py-3`} required />
                        </div>

                        <div>
                            <label className={labelClass}>Invoice/Receipt Footer Message</label>
                            <textarea name="receiptFooter" value={formData.receiptFooter} onChange={handleChange} className={`${inputClass} min-h-[100px] py-3`} required />
                        </div>

                        <div className="pt-4">
                            <label className={labelClass}>Statement Header (Reports)</label>
                            <textarea name="statementHeader" value={formData.statementHeader} onChange={handleChange} className={`${inputClass} min-h-[80px] py-3`} required />
                        </div>

                        <div>
                            <label className={labelClass}>Statement Footer Message</label>
                            <textarea name="statementFooter" value={formData.statementFooter} onChange={handleChange} className={`${inputClass} min-h-[100px] py-3`} required />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="submit" className="bg-[#1A2232] text-yellow-400 px-10 py-4 rounded-2xl font-black flex items-center shadow-xl hover:bg-gray-800 transition-all active:scale-95 uppercase tracking-widest text-[10px] border border-yellow-400/20">
                        <SaveIcon className="w-5 h-5 mr-3" /> Commit System Changes
                    </button>
                </div>
            </form>

            {/* Expense Categories */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Expense Categories</h3>
                    <button onClick={() => setIsCatAddOpen(true)}
                        className="flex items-center bg-yellow-400 text-[#1A2232] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-500 shadow-md active:scale-95 transition-all">
                        <PlusIcon className="w-4 h-4 mr-1" /> New Category
                    </button>
                </div>
                <table className="w-full text-sm text-left">
                    <thead className="text-[9px] text-gray-400 uppercase bg-gray-50 font-black tracking-widest">
                        <tr>
                            <th className="px-4 py-3">Category Name</th>
                            <th className="px-4 py-3 w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {expenseCategories.map(cat => (
                            <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-2.5 font-bold text-gray-900 text-[11px]">{cat.name}</td>
                                <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => { setEditingCat(cat); setIsCatEditOpen(true); }} title="Edit"
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-all active:scale-90">
                                            <EditIcon className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => { setDeletingCat(cat); setIsCatDeleteOpen(true); }} title="Delete"
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90">
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {expenseCategories.length === 0 && (
                            <tr><td colSpan={2} className="px-4 py-10 text-center text-[10px] text-gray-300 font-black uppercase tracking-widest">No categories yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Category Modal */}
            <Modal isOpen={isCatAddOpen} onClose={() => setIsCatAddOpen(false)} title="New Expense Category">
                <form onSubmit={handleAddCategory} className="space-y-4">
                    <label className={labelClass}>Category Name</label>
                    <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                        className={inputClass} required autoFocus placeholder="e.g. Electricity" />
                    <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-gray-800 transition-all">
                        Add Category
                    </button>
                </form>
            </Modal>

            {/* Edit Category Modal */}
            {editingCat && (
                <Modal isOpen={isCatEditOpen} onClose={() => { setIsCatEditOpen(false); setEditingCat(null); }} title="Edit Category">
                    <form onSubmit={handleUpdateCategory} className="space-y-4">
                        <label className={labelClass}>Category Name</label>
                        <input type="text" value={editingCat.name} onChange={e => setEditingCat({ ...editingCat, name: e.target.value })}
                            className={inputClass} required autoFocus />
                        <button type="submit" className="w-full bg-[#1A2232] text-yellow-400 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-gray-800 transition-all">
                            Save Changes
                        </button>
                    </form>
                </Modal>
            )}

            <ConfirmationModal
                isOpen={isCatDeleteOpen}
                onClose={() => setIsCatDeleteOpen(false)}
                onConfirm={() => { if (deletingCat) { onDeleteExpenseCategory(deletingCat.id); setDeletingCat(null); } }}
                title="Delete Category"
                message={`Permanently delete "${deletingCat?.name}"?`}
            />
        </div>
    );
};

export default SettingsView;
