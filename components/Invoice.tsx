
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
  .invoice-container { 
    max-width: 800px; 
    margin: auto; 
    padding: 20px 30px; 
    border: 1px solid #edf2f7; 
    border-radius: 12px;
    font-family: 'Inter', -apple-system, sans-serif; 
    color: #1a202c; 
    background: #fff; 
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .invoice-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    margin-bottom: 20px; 
    border-bottom: 1px solid #edf2f7;
    padding-bottom: 12px;
  }
  .brand-details { font-size: 10px; color: #4a5568; line-height: 1.4; }
  .brand-details p { margin: 0; }
  
  .invoice-meta { text-align: right; }
  .invoice-id { font-size: 14px; font-weight: 800; color: #000; text-transform: uppercase; }
  .invoice-date { font-size: 11px; color: #718096; margin-top: 1px; }

  .info-grid { 
    display: grid; 
    grid-template-cols: 1fr 1fr; 
    gap: 20px; 
    margin-bottom: 20px; 
  }
  .info-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #a0aec0; margin-bottom: 3px; letter-spacing: 0.5px; }
  .info-value { font-size: 12px; color: #2d3748; line-height: 1.4; }
  .info-value strong { color: #000; font-weight: 700; }

  .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .invoice-table th { 
    background: #f8fafc; 
    text-align: left; 
    padding: 8px 12px; 
    font-size: 10px; 
    font-weight: 800; 
    text-transform: uppercase; 
    color: #4a5568;
    border-bottom: 1px solid #edf2f7;
  }
  .invoice-table td { padding: 8px 12px; border-bottom: 1px solid #f7fafc; font-size: 12px; color: #1a202c; }
  .invoice-table .text-right { text-align: right; }
  
  .summary-section { display: flex; justify-content: space-between; align-items: flex-start; }
  .qr-code-section { 
    text-align: center; 
    background: #fff;
    padding: 8px;
    border: 1px solid #edf2f7;
    border-radius: 8px;
  }
  .qr-code-label { font-size: 8px; color: #718096; margin-top: 2px; font-weight: 700; text-transform: uppercase; }
  
  .totals-table { width: 260px; }
  .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; color: #4a5568; }
  .total-row.grand-total { 
    border-top: 1px solid #edf2f7; 
    margin-top: 8px; 
    padding-top: 8px; 
    font-size: 16px; 
    font-weight: 800; 
    color: #000; 
  }
  .status-badge { 
    display: inline-block; 
    padding: 2px 10px; 
    border-radius: 6px; 
    font-size: 10px; 
    font-weight: 800; 
    margin-top: 6px;
    text-transform: uppercase;
  }
  .status-unpaid { background: #fff5f5; color: #c53030; }
  .status-paid { background: #f0fff4; color: #2f855a; }
  .status-partial { background: #fffaf0; color: #c05621; }

  .invoice-footer { 
    margin-top: 30px; 
    padding-top: 15px; 
    border-top: 1px solid #f7fafc; 
    text-align: center; 
  }
  .thanks-msg { font-size: 13px; font-weight: 800; color: #000; margin-bottom: 2px; }
  .terms { font-size: 10px; color: #a0aec0; }

  @media print {
    @page { margin: 10mm; }
    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-container { 
      border: none !important; 
      padding: 0 !important; 
      width: 100% !important;
      max-width: 600px !important; /* Tighten max-width further */
      margin: 0 auto !important;
      color: #000 !important;
      box-shadow: none !important;
    }
    .invoice-header { margin-bottom: 12px !important; padding-bottom: 8px !important; }
    
    /* Target the logo to make it specifically smaller in print */
    .invoice-header img { height: 1.5rem !important; max-width: 100px !important; }
    
    .invoice-table td, .info-value, .total-row, .total-row.grand-total { font-size: 10px !important; }
    .total-row.grand-total { font-size: 13px !important; }
    .brand-details { font-size: 8px !important; }
    .info-label, .invoice-table th { font-size: 8px !important; }
    .qr-code-section img { width: 40px !important; height: 40px !important; }
    .no-print { display: none !important; }
    img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

const Invoice: React.FC<InvoiceProps> = ({ isOpen, onClose, sale }) => {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const subtotal = sale.subtotal || sale.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = sale.discount || 0;
  const discountPercent = subtotal > 0 ? (discount / subtotal) * 100 : 0;
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
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
          ${invoiceStyles}
        </style>
      `);
      printWindow.document.write('</head><body>');
      printWindow.document.write('<div class="no-print" style="text-align:center; padding: 20px; font-size: 12px; color: #666;">Preparing document for export...</div>');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      
      const triggerPrint = () => {
          printWindow.focus();
          const loader = printWindow.document.querySelector('.no-print');
          if (loader) loader.remove();
          setTimeout(() => {
            printWindow.print();
          }, 500);
      };
      
      triggerPrint();
    }
  };

  const getStatusClass = () => {
    if (sale.status === 'Paid') return 'status-paid';
    if (sale.status === 'Partially Paid') return 'status-partial';
    return 'status-unpaid';
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=EKO-INV-${sale.id.substring(0,8)}&color=0-0-0&bgcolor=255-255-255&margin=1`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invoice Detail`}>
      <style>{invoiceStyles}</style>
      <div className="bg-gray-100 p-2 sm:p-4 rounded-xl overflow-x-hidden">
        <div className="invoice-container shadow-md mx-auto bg-white" ref={invoiceRef}>
            <div className="invoice-header">
                <div className="flex items-center gap-4">
                    <Logo className="h-6" showTagline={false} />
                    <div className="brand-details">
                        <p><strong>Email:</strong> ekoprints256@gmail.com</p>
                        <p><strong>Tel:</strong> 0792832056 / 0703580516</p>
                        <p><strong>Location:</strong> Masaka City</p>
                    </div>
                </div>
                <div className="invoice-meta">
                    <div className="invoice-id">INV-#{sale.id.substring(0, 8).toUpperCase()}</div>
                    <div className="invoice-date">Date: {new Date(sale.date).toLocaleDateString()}</div>
                    <div className={`status-badge ${getStatusClass()}`}>
                        {sale.status}
                    </div>
                </div>
            </div>

            <div className="info-grid">
                <div>
                    <div className="info-label">Billed To</div>
                    <div className="info-value">
                        <strong>{sale.customer.name}</strong><br />
                        {sale.customer.phone && <span className="text-gray-500">{sale.customer.phone}</span>}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="info-label">Payment Mode</div>
                    <div className="info-value">
                        Cash / MM<br />
                        <span className="font-bold">UGX</span>
                    </div>
                </div>
            </div>

            <table className="invoice-table">
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((item, index) => (
                        <tr key={index}>
                            <td className="font-medium">{item.name}</td>
                            <td className="text-right">{item.quantity}</td>
                            <td className="text-right text-gray-500">{formatUGX(item.price).replace(' UGX', '')}</td>
                            <td className="text-right font-bold">{formatUGX(item.price * item.quantity)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="summary-section">
                <div className="qr-code-section">
                    <img src={qrCodeUrl} alt="Invoice QR Code" width="50" height="50" className="mx-auto block" />
                    <div className="qr-code-label">Eko Verify</div>
                </div>
                <div className="totals-table">
                    <div className="total-row">
                        <span>Subtotal</span>
                        <span>{formatUGX(subtotal)}</span>
                    </div>
                    {discount > 0 && (
                        <div className="total-row" style={{ color: '#c53030' }}>
                            <span>Discount ({discountPercent.toFixed(1)}%)</span>
                            <span>-{formatUGX(discount)}</span>
                        </div>
                    )}
                    <div className="total-row" style={{ color: '#2f855a' }}>
                        <span>Paid</span>
                        <span>{formatUGX(paid)}</span>
                    </div>
                    {balance > 0 && (
                        <div className="total-row" style={{ color: '#c53030', fontWeight: 'bold' }}>
                            <span>Balance</span>
                            <span>{formatUGX(balance)}</span>
                        </div>
                    )}
                    <div className="total-row grand-total">
                        <span>Grand Total</span>
                        <span>{formatUGX(grandTotal)}</span>
                    </div>
                </div>
            </div>

            <div className="invoice-footer">
                <p className="thanks-msg">Thank you for choosing Eko Prints!</p>
                <p className="terms">Terms: Non-returnable once sold. Official receipt issued on full payment.</p>
            </div>
        </div>
      </div>
      
      <div className="mt-4 flex justify-between items-center px-4">
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Eko Prints Management System</p>
        <button onClick={handlePrint} className="flex items-center bg-gray-900 text-yellow-400 px-6 py-2.5 rounded-xl shadow-xl hover:bg-black transition-all transform hover:-translate-y-0.5 font-black uppercase text-xs tracking-widest">
          <PrintIcon className="w-4 h-4 mr-2" />
          Export to PDF
        </button>
      </div>
    </Modal>
  );
};

export default Invoice;
