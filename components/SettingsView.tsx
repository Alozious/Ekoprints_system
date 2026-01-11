
import React, { useState, useEffect } from 'react';
import { SystemSettings } from '../types';
import { SaveIcon } from './icons';

interface SettingsViewProps {
    settings: SystemSettings;
    onUpdateSettings: (settings: SystemSettings) => Promise<void>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings }) => {
    const [formData, setFormData] = useState<SystemSettings>(settings);

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
        </div>
    );
};

export default SettingsView;
