
import React from 'react';
import { Sale, Customer } from '../types';
import { PrintIcon } from './icons';
import Modal from './Modal';
import Logo from './Logo';

interface InvoiceProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale & { customer: Customer };
}

const formatUGX = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0 UGX';
    return new Intl.NumberFormat('en-US').format(Math.round(amount)) + ' UGX';
};

const invoiceStyles = `
  .invoice-paper { 
    max-width: 800px; 
    margin: auto; 
    padding: 40px 50px; 
    font-family: 'Poppins', sans-serif; 
    color: #1a2232; 
    background: #fff; 
    position: relative;
    border: 1px solid #f1f5f9;
    border-radius: 2rem;
  }
  .invoice-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 120px;
    font-weight: 900;
    color: rgba(0,0,0,0.02);
    pointer-events: none;
    z-index: 0;
    text-transform: uppercase;
    letter-spacing: 20px;
  }
  .invoice-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-start; 
    margin-bottom: 50px; 
    position: relative;
    z-index: 1;
  }
  .brand-meta { font-size: 11px; color: #64748b; line-height: 1.8; margin-top: 15px; font-weight: 500; }
  .brand-meta strong { color: #1e293b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
  
  .invoice-details { text-align: right; }
  .invoice-label { font-size: 10px; font-weight: 900; color: #2563eb; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 8px; }
  .invoice-number { font-size: 28px; font-weight: 900; color: #1a2232; tracking: -1px; margin-bottom: 5px; }
  .invoice-date { font-size: 12px; font-weight: 700; color: #94a3b8; }

  .bill-grid { 
    display: grid; 
    grid-template-cols: 1fr 1fr; 
    gap: 40px; 
    margin-bottom: 50px; 
    position: relative;
    z-index: 1;
  }
  .section-title { font-size: 9px; font-weight: 900; text-transform: uppercase; color: #cbd5e1; margin-bottom: 15px; letter-spacing: 3px; }
  .client-card { 
    padding: 25px; 
    background: #f8fafc; 
    border-radius: 1.5rem; 
    border: 1px solid #f1f5f9;
  }
  .client-name { font-size: 18px; font-weight: 900; color: #1a2232; text-transform: uppercase; margin-bottom: 5px; }
  .client-info { font-size: 11px; color: #64748b; font-weight: 500; }

  .invoice-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; margin-bottom: 40px; position: relative; z-index: 1; }
  .invoice-table th { 
    text-align: left; 
    padding: 15px 20px; 
    font-size: 10px; 
    font-weight: 900; 
    text-transform: uppercase; 
    color: #94a3b8;
    letter-spacing: 2px;
  }
  .invoice-table td { 
    padding: 20px; 
    background: #fff;
    border-top: 1px solid #f1f5f9;
    border-bottom: 1px solid #f1f5f9;
    font-size: 13px; 
    font-weight: 700;
  }
  .invoice-table td:first-child { border-left: 1px solid #f1f5f9; border-radius: 1rem 0 0 1rem; }
  .invoice-table td:last-child { border-right: 1px solid #f1f5f9; border-radius: 0 1rem 1rem 0; text-align: right; }
  .invoice-table .price-col { color: #64748b; text-align: right; }
  .invoice-table .qty-col { text-align: center; color: #2563eb; }

  .summary-panel { 
    display: flex; 
    justify-content: flex-end; 
    position: relative;
    z-index: 1;
  }
  .summary-box { 
    width: 320px; 
    background: #1a2232; 
    padding: 35px; 
    border-radius: 2.5rem; 
    color: #fff;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }
  .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 12px; font-weight: 600; color: #94a3b8; }
  .summary-row.total { 
    border-top: 1px solid rgba(255,255,255,0.1); 
    margin-top: 15px; 
    padding-top: 20px; 
    font-size: 24px; 
    font-weight: 900; 
    color: #fbbf24; 
  }
  .summary-row.discount { color: #f87171; }

  .footer { 
    margin-top: 60px; 
    text-align: center; 
    padding-top: 30px;
    border-top: 1px solid #f1f5f9;
    position: relative;
    z-index: 1;
  }
  .footer-thanks { font-size: 16px; font-weight: 900; color: #1a2232; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
  .footer-terms { font-size: 10px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }

  @media print {
    body { background: white !important; }
    .invoice-paper { border: none !important; box-shadow: none !important; padding: 0 !important; width: 100% !important; }
    .no-print { display: none !important; }
    .summary-box { background: #1a2232 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-watermark { display: block !important; }
  }
`;

const Invoice: React.FC<InvoiceProps> = ({ isOpen, onClose, sale }) => {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const subtotal = sale.subtotal || sale.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = sale.discount || 0;
  const grandTotal = sale.total;
  const paid = sale.amountPaid || 0;
  const balance = grandTotal - paid;

  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Eko Prints Invoice</title>');
      printWindow.document.write(`
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          ${invoiceStyles}
          body { margin: 0; padding: 20px; }
        </style>
      `);
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      
      setTimeout(() => {
          printWindow.focus();
          printWindow.print();
      }, 500);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invoice Authentication Preview">
      <style>{invoiceStyles}</style>
      <div className="bg-gray-50 p-4 sm:p-10 rounded-[3rem] overflow-x-hidden">
        <div className="invoice-paper shadow-2xl mx-auto" ref={invoiceRef}>
            <div className="invoice-watermark">EKO</div>
            
            <div className="invoice-header">
                <div className="flex flex-col items-start">
                    <Logo className="h-16" showTagline={false} />
                    <div className="brand-meta">
                        <p><strong>Official Mail:</strong> ekoprints256@gmail.com</p>
                        <p><strong>Helpline:</strong> 0792 832 056 / 0703 580 516</p>
                        <p><strong>Operational Hub:</strong> Masaka City, UG</p>
                    </div>
                </div>
                <div className="invoice-details">
                    <div className="invoice-label">Document Ref</div>
                    <div className="invoice-number">#{sale.id.substring(0, 8).toUpperCase()}</div>
                    <div className="invoice-date">Issue Date: {new Date(sale.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                </div>
            </div>

            <div className="bill-grid">
                <div>
                    <div className="section-title">Billed To Profile</div>
                    <div className="client-card">
                        <div className="client-name">{sale.customer.name}</div>
                        <div className="client-info">
                            <p>{sale.customer.email}</p>
                            <p>{sale.customer.phone || 'No Contact Provided'}</p>
                            <p className="mt-2 text-gray-400 italic">{sale.customer.address || 'Standard Pickup'}</p>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="section-title">Payment Intelligence</div>
                    <div className="client-card bg-white">
                        <div className="text-2xl font-black text-blue-600 uppercase tracking-tight">{sale.status}</div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">Currency: UGX (Shillings)</div>
                        {balance > 0 && (
                            <div className="mt-4 p-3 bg-red-50 rounded-xl inline-block">
                                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Arrears: {formatUGX(balance)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <table className="invoice-table">
                <thead>
                    <tr>
                        <th>Item Specifications</th>
                        <th className="qty-col">Qty</th>
                        <th className="price-col">Unit Rate</th>
                        <th className="price-col">Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((item, index) => (
                        <tr key={index}>
                            <td>{item.name}</td>
                            <td className="qty-col">{item.quantity}</td>
                            <td className="price-col">{formatUGX(item.price).replace(' UGX', '')}</td>
                            <td className="price-col">{formatUGX(item.price * item.quantity)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="summary-panel">
                <div className="summary-box">
                    <div className="summary-row">
                        <span>Cumulative Subtotal</span>
                        <span>{formatUGX(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="summary-row discount">
                            <span>Client Loyalty Discount</span>
                            <span>-{formatUGX(discount)}</span>
                        </div>
                    )}
                    <div className="summary-row">
                        <span>Payments Received</span>
                        <span className="text-emerald-400">{formatUGX(paid)}</span>
                    </div>
                    <div className="summary-row total">
                        <span>Grand Total</span>
                        <span>{formatUGX(grandTotal)}</span>
                    </div>
                    <div className="mt-6 flex justify-center">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=EKO-INV-${sale.id.substring(0,8)}&color=255-255-255&bgcolor=1a2232&margin=1`} 
                            alt="Eko Verify QR" 
                            width="60" 
                            height="60" 
                            className="opacity-50"
                        />
                    </div>
                </div>
            </div>

            <div className="footer">
                <p className="footer-thanks">Design | Print | Brand</p>
                <p className="footer-terms">Goods once delivered cannot be returned. Please retain this invoice for your records.</p>
                <p className="mt-4 text-[8px] text-gray-300 font-bold uppercase tracking-[0.5em]">Eko Prints Management System v2.5</p>
            </div>
        </div>
      </div>
      
      <div className="mt-8 flex justify-between items-center px-10">
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.4em]">Authorized Digital Document</p>
        <button onClick={handlePrint} className="flex items-center bg-[#1A2232] text-yellow-400 px-10 py-4 rounded-3xl shadow-2xl hover:bg-gray-800 transition-all transform hover:-translate-y-1 font-black uppercase text-xs tracking-[0.2em] border border-yellow-400/20">
          <PrintIcon className="w-5 h-5 mr-3" />
          Export Professional PDF
        </button>
      </div>
    </Modal>
  );
};

export default Invoice;
