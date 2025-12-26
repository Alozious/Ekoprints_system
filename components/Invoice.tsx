
import React from 'react';
import { Sale, Customer } from '../types';
import { PrintIcon } from './icons';
import Modal from './Modal';

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
    padding: 40px; 
    border: 1px solid #e2e8f0; 
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
    align-items: flex-start; 
    margin-bottom: 40px; 
    border-bottom: 2px solid #f7fafc;
    padding-bottom: 20px;
  }
  .brand-section h1 { 
    font-size: 28px; 
    font-weight: 800; 
    color: #1a2232; 
    margin: 0; 
    letter-spacing: -0.5px;
  }
  .brand-section span { color: #d97706; }
  .brand-tagline {
    font-size: 10px;
    font-weight: 700;
    color: #4a5568;
    letter-spacing: 1.5px;
    margin-top: -2px;
    margin-bottom: 10px;
    text-transform: uppercase;
  }
  .brand-details { font-size: 13px; color: #4a5568; margin-top: 8px; line-height: 1.5; }
  
  .invoice-meta { text-align: right; }
  .invoice-id { font-size: 20px; font-weight: 700; color: #1a202c; }
  .invoice-date { font-size: 14px; color: #718096; margin-top: 4px; }

  .info-grid { 
    display: grid; 
    grid-template-cols: 1fr 1fr; 
    gap: 40px; 
    margin-bottom: 40px; 
  }
  .info-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #718096; margin-bottom: 8px; letter-spacing: 0.5px; }
  .info-value { font-size: 14px; color: #2d3748; line-height: 1.5; }
  .info-value strong { color: #000000; }

  .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  .invoice-table th { 
    background: #f7fafc; 
    text-align: left; 
    padding: 12px 15px; 
    font-size: 12px; 
    font-weight: 700; 
    text-transform: uppercase; 
    color: #4a5568;
    border-bottom: 2px solid #edf2f7;
  }
  .invoice-table td { padding: 15px; border-bottom: 1px solid #edf2f7; font-size: 14px; color: #1a202c; }
  .invoice-table .text-right { text-align: right; }
  
  .summary-section { display: flex; justify-content: space-between; align-items: flex-end; }
  .qr-code-section { 
    text-align: center; 
    background: #fff;
    padding: 10px;
    border: 1px solid #edf2f7;
    border-radius: 8px;
  }
  .qr-code-label { font-size: 10px; color: #4a5568; margin-top: 6px; font-weight: 600; }
  
  .totals-table { width: 300px; }
  .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #2d3748; }
  .total-row.grand-total { 
    border-top: 2px solid #edf2f7; 
    margin-top: 10px; 
    padding-top: 15px; 
    font-size: 18px; 
    font-weight: 800; 
    color: #000000; 
  }
  .status-badge { 
    display: inline-block; 
    padding: 4px 12px; 
    border-radius: 99px; 
    font-size: 12px; 
    font-weight: 700; 
    margin-top: 10px;
  }
  .status-unpaid { background: #fff5f5; color: #c53030; }
  .status-paid { background: #f0fff4; color: #2f855a; }
  .status-partial { background: #fffaf0; color: #c05621; }

  .invoice-footer { 
    margin-top: 60px; 
    padding-top: 20px; 
    border-top: 1px solid #edf2f7; 
    text-align: center; 
  }
  .thanks-msg { font-size: 16px; font-weight: 700; color: #1a202c; margin-bottom: 5px; }
  .terms { font-size: 12px; color: #718096; }

  @media print {
    .invoice-container { 
      border: none !important; 
      padding: 0 !important; 
      width: 100% !important;
      max-width: none !important;
      color: #000 !important;
    }
    .no-print { display: none !important; }
    img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-table td, .info-value, .total-row { color: #000 !important; }
  }
`;

const Invoice: React.FC<InvoiceProps> = ({ isOpen, onClose, sale }) => {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const paid = sale.amountPaid || 0;
  const balance = sale.total - paid;

  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Eko Prints Invoice</title>');
      printWindow.document.write(`
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; background: #fff; color: #000; }
          ${invoiceStyles}
        </style>
      `);
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      
      const images = printWindow.document.querySelectorAll('img');
      let loadedImages = 0;
      const totalImages = images.length;

      const triggerPrint = () => {
          printWindow.focus();
          printWindow.print();
      };

      if (totalImages === 0) {
          triggerPrint();
      } else {
          images.forEach(img => {
              if (img.complete) {
                  loadedImages++;
                  if (loadedImages === totalImages) triggerPrint();
              } else {
                  img.onload = () => {
                      loadedImages++;
                      if (loadedImages === totalImages) triggerPrint();
                  };
                  img.onerror = () => {
                      loadedImages++;
                      if (loadedImages === totalImages) triggerPrint();
                  };
              }
          });
          setTimeout(() => {
              if (loadedImages < totalImages) triggerPrint();
          }, 2000);
      }
    }
  };

  const getStatusClass = () => {
    if (sale.status === 'Paid') return 'status-paid';
    if (sale.status === 'Partially Paid') return 'status-partial';
    return 'status-unpaid';
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=EKO-INV-${sale.id.substring(0,8)}&color=0-0-0&bgcolor=255-255-255&margin=1`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Invoice Detail`}>
      <style>{invoiceStyles}</style>
      <div className="bg-gray-50 p-2 sm:p-4 rounded-lg overflow-x-hidden">
        <div className="invoice-container shadow-sm mx-auto bg-white" ref={invoiceRef}>
            <div className="invoice-header">
                <div className="brand-section">
                    <h1>Eko<span>Prints</span></h1>
                    <div className="brand-tagline">DESIGN | PRINT | BRAND</div>
                    <div className="brand-details">
                        <p><strong>Email:</strong> ekoprints256@gmail.com</p>
                        <p><strong>Tel:</strong> 0792832056 / 0703580516</p>
                        <p><strong>Location:</strong> City View Complex, Masaka City, Level 3, Room Number L3-194</p>
                    </div>
                </div>
                <div className="invoice-meta">
                    <div className="invoice-id">INVOICE #{sale.id.substring(0, 8).toUpperCase()}</div>
                    <div className="invoice-date">Date Issued: {new Date(sale.date).toLocaleDateString()}</div>
                    <div className={`status-badge ${getStatusClass()}`}>
                        {sale.status.toUpperCase()}
                    </div>
                </div>
            </div>

            <div className="info-grid">
                <div>
                    <div className="info-label">Billed To</div>
                    <div className="info-value">
                        <strong>{sale.customer.name}</strong><br />
                        {sale.customer.phone && <>{sale.customer.phone}<br /></>}
                        {sale.customer.email && <>{sale.customer.email}<br /></>}
                        {sale.customer.address}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div className="info-label">Payment Information</div>
                    <div className="info-value">
                        Method: Cash / Mobile Money<br />
                        Currency: UGX
                    </div>
                </div>
            </div>

            <table className="invoice-table">
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Price</th>
                        <th className="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {sale.items.map((item, index) => (
                        <tr key={index}>
                            <td>{item.name}</td>
                            <td className="text-right">{item.quantity}</td>
                            <td className="text-right">{formatUGX(item.price).replace(' UGX', '')}</td>
                            <td className="text-right">{formatUGX(item.price * item.quantity)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="summary-section">
                <div className="qr-code-section">
                    <img src={qrCodeUrl} alt="Invoice QR Code" width="120" height="120" className="mx-auto block" style={{ imageRendering: 'pixelated' }} />
                    <div className="qr-code-label">VERIFY INVOICE</div>
                </div>
                <div className="totals-table">
                    <div className="total-row">
                        <span style={{color: '#4a5568'}}>Subtotal</span>
                        <span style={{fontWeight: 600, color: '#1a202c'}}>{formatUGX(sale.total)}</span>
                    </div>
                    <div className="total-row">
                        <span style={{color: '#2f855a', fontWeight: 600}}>Amount Paid</span>
                        <span style={{color: '#2f855a', fontWeight: 600}}>{formatUGX(paid)}</span>
                    </div>
                    {balance > 0 && (
                        <div className="total-row">
                            <span style={{color: '#c53030', fontWeight: 600}}>Balance Due</span>
                            <span style={{color: '#c53030', fontWeight: 600}}>{formatUGX(balance)}</span>
                        </div>
                    )}
                    <div className="total-row grand-total">
                        <span>Total Due</span>
                        <span>{formatUGX(sale.total)}</span>
                    </div>
                </div>
            </div>

            <div className="invoice-footer">
                <p className="thanks-msg">Thanks for the purchase!</p>
                <p className="terms">Goods once sold are not returnable. Thank you for choosing Eko Prints.</p>
            </div>
        </div>
      </div>
      
      <div className="mt-6 flex justify-between items-center px-4">
        <p className="text-xs text-gray-500 italic">This is a system generated document.</p>
        <button onClick={handlePrint} className="flex items-center bg-blue-600 text-white px-6 py-2.5 rounded-xl shadow-lg hover:bg-blue-700 transition-all transform hover:-translate-y-1 font-bold">
          <PrintIcon className="w-5 h-5 mr-2" />
          Print Professional Invoice
        </button>
      </div>
    </Modal>
  );
};

export default Invoice;
