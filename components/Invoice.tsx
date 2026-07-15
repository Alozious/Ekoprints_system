
import React from 'react';
import { Sale, Customer, SystemSettings } from '../types';
import { PrintIcon } from './icons';
import Modal from './Modal';
import logoAsset from '../assets/logo.png';
import bgAsset from '../assets/invoice_receipt_bg.png';

interface InvoiceProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale & { customer: Customer };
  settings: SystemSettings;
  isQuotation?: boolean;
}

const fmt = (amount: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(amount));
};

const fmtUGX = (amount: number) => fmt(amount) + ' UGX';

/* ─── Circular brand-colored SVG icons for contact rows ──────────────────────────── */
const EmailIcon = () => (
  <div style={{
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#6d28d9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    flexShrink: 0
  }} className="inv-icon-circle">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  </div>
);

const PhoneIcon = () => (
  <div style={{
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#6d28d9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    flexShrink: 0
  }} className="inv-icon-circle">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 21 17z"/>
    </svg>
  </div>
);

const LocationIcon = () => (
  <div style={{
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#6d28d9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    flexShrink: 0
  }} className="inv-icon-circle">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
      <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  </div>
);

/* ─── Styles ────────────────────────────────────────────────────── */
const invoiceStyles = (bgUrl: string) => `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .inv-page {
    width: 100%;
    min-height: 100%;
    position: relative;
    font-family: 'Inter', -apple-system, sans-serif;
    color: #111827;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow: hidden;
  }

  /* ── full-bleed background (transparency increased so it is less visible) ── */
  .inv-bg {
    position: absolute;
    inset: 0;
    background-image: url('${bgUrl}');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.15;
    pointer-events: none;
    z-index: 0;
  }

  /* ── all content sits above bg and is pushed down ── */
  .inv-body {
    position: relative;
    z-index: 1;
    padding: 85px 45px 35px;
  }

  /* ── HEADER ── */
  .inv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 30px;
  }
  .inv-logo { height: 75px; width: auto; object-fit: contain; display: block; }
  .inv-contact { margin-top: 15px; display: flex; flex-direction: column; gap: 8px; }
  .inv-contact-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: #374151;
  }
  .inv-contact-label { font-weight: 800; color: #111827; }
  .inv-contact-text { font-weight: 500; }

  .inv-meta { text-align: right; }
  .inv-ref {
    font-size: 26px;
    font-weight: 900;
    color: #111827;
    letter-spacing: -0.5px;
    line-height: 1;
  }
  .inv-date { font-size: 13px; color: #4b5563; font-weight: 600; margin-top: 6px; }
  .inv-badge {
    display: inline-block;
    margin-top: 12px;
    padding: 8px 24px;
    background: #f59e0b;
    color: #1c1917;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 6px;
  }
  .inv-badge.paid   { background: #d1fae5; color: #065f46; }
  .inv-badge.partial{ background: #fef3c7; color: #92400e; }
  .inv-badge.unpaid { background: #fee2e2; color: #991b1b; }
  .inv-badge.quote  { background: #fbbf24; color: #1c1917; }

  /* ── DIVIDER ── */
  .inv-divider { border: none; border-top: 1px solid rgba(0,0,0,0.12); margin: 0 0 25px; }

  /* ── CLIENT ── */
  .inv-client-label {
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #6d28d9;
    margin-bottom: 6px;
  }
  .inv-client-name { font-size: 26px; font-weight: 900; color: #111827; margin-bottom: 25px; }

  /* ── TABLE ── */
  .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  .inv-table thead tr { border-bottom: 2px solid rgba(0,0,0,0.12); }
  .inv-table th {
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #6d28d9;
    padding: 12px 10px 12px 0;
    text-align: left;
  }
  .inv-table th.r { text-align: right; }
  .inv-table td {
    padding: 14px 10px 14px 0;
    font-size: 14px;
    color: #1f2937;
    border-bottom: 1px solid rgba(0,0,0,0.08);
    vertical-align: middle;
    font-weight: 500;
  }
  .inv-table td.r { text-align: right; font-weight: 800; color: #111827; }
  .inv-table td.price { text-align: right; color: #4b5563; font-weight: 600; }

  /* ── LOWER SECTION: rules left, totals right ── */
  .inv-lower {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 30px;
    margin-bottom: 35px;
  }
  .inv-rules { flex: 1; }
  .inv-rules-label {
    font-size: 13px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #6d28d9;
    margin-bottom: 8px;
  }
  .inv-rules ul { padding-left: 18px; }
  .inv-rules li { font-size: 13px; color: #374151; line-height: 1.6; font-weight: 500; }

  .inv-totals { min-width: 250px; }
  .inv-total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 6px 0;
    font-size: 13px;
    color: #374151;
    border-bottom: 1px solid rgba(0,0,0,0.08);
    font-weight: 600;
  }
  .inv-total-row.grand {
    border-bottom: none;
    border-top: 2px solid rgba(0,0,0,0.15);
    margin-top: 6px;
    padding-top: 10px;
  }
  .inv-total-row.grand .inv-total-lbl { font-size: 14px; font-weight: 900; color: #111827; }
  .inv-total-row.grand .inv-total-val { font-size: 20px; font-weight: 900; color: #111827; }
  .inv-total-lbl { font-weight: 600; }
  .inv-total-val { font-weight: 800; color: #111827; }
  .inv-total-val.disc { color: #dc2626; }
  .inv-total-val.paid-c { color: #059669; }

  /* ── QR + FOOTER ── */
  .inv-qr-row { display: flex; align-items: center; gap: 10px; margin-bottom: 30px; }
  .inv-qr-img { width: 75px; height: 75px; border: 1px solid #e5e7eb; border-radius: 6px; }
  .inv-qr-label { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #6d28d9; margin-top: 4px; text-align: center; }

  .inv-footer {
    text-align: center;
    border-top: 1px solid rgba(0,0,0,0.1);
    padding-top: 20px;
  }
  .inv-footer-logo { height: 28px; width: auto; margin: 0 auto 6px; display: block; }
  .inv-footer-name { font-size: 15px; font-weight: 900; letter-spacing: 0.05em; color: #111827; }
  .inv-footer-divider {
    width: 60px; height: 2px;
    background: linear-gradient(90deg, #6d28d9, #f59e0b);
    margin: 8px auto;
    border-radius: 2px;
  }
  .inv-footer-tagline { font-size: 12px; color: #4b5563; font-weight: 600; }

  @media print {
    @page { margin: 0; size: A4; }
    body { margin: 0; background: transparent !important; }
    .inv-page { min-height: 100vh; }
    .inv-bg { opacity: 0.15 !important; }
    .no-print { display: none !important; }
  }
`;

/* ─── Helper: build print-ready HTML ──────────────────────────── */
function buildPrintHtml(params: {
  bgUrl: string; logoUrl: string; qrUrl: string;
  isQuotation: boolean; sale: Sale & { customer: Customer };
  settings: SystemSettings;
  subtotal: number; discount: number; discountPercent: number;
  grandTotal: number; paid: number; balance: number;
}) {
  const { bgUrl, logoUrl, qrUrl, isQuotation, sale, settings, subtotal, discount, discountPercent, grandTotal, paid, balance } = params;

  const badgeClass = isQuotation ? 'quote' : (sale.status === 'Paid' ? 'paid' : sale.status === 'Partially Paid' ? 'partial' : 'unpaid');
  const badgeText = isQuotation ? 'Quotation' : sale.status;
  const refPrefix = isQuotation ? 'QT' : 'INV';

  const rulesHtml = (sale.rules && sale.rules.length > 0)
    ? `<div class="inv-rules-label">Invoice Terms &amp; Rules</div>
       <ul>${sale.rules.map(r => `<li>${r}</li>`).join('')}</ul>`
    : '';

  const paidRowHtml = !isQuotation ? `
    <div class="inv-total-row">
      <span class="inv-total-lbl">Paid</span>
      <span class="inv-total-val paid-c">${fmt(paid)} UGX</span>
    </div>
    ${balance > 0 ? `<div class="inv-total-row"><span class="inv-total-lbl">Balance</span><span class="inv-total-val disc">${fmt(balance)} UGX</span></div>` : ''}
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>${settings.businessName} ${isQuotation ? 'Quotation' : 'Invoice'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  body { margin:0; padding:0; background:#fff; }
  ${invoiceStyles(bgUrl)}
  /* Ensure circles show up beautifully in print */
  .inv-icon-circle {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    background-color: #6d28d9 !important;
    color: #ffffff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
</style>
</head>
<body>
<div class="inv-page">
  <div class="inv-bg"></div>
  <div class="inv-body">
    <!-- HEADER -->
    <div class="inv-header">
      <div>
        <img src="${logoUrl}" class="inv-logo" alt="Logo"/>
        <div class="inv-contact">
          <div class="inv-contact-row">
            <div class="inv-icon-circle" style="width:24px;height:24px;border-radius:50%;background-color:#6d28d9;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </div>
            <span><span class="inv-contact-label">Email:</span> ${settings.businessEmail}</span>
          </div>
          <div class="inv-contact-row">
            <div class="inv-icon-circle" style="width:24px;height:24px;border-radius:50%;background-color:#6d28d9;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 21 17z"/></svg>
            </div>
            <span><span class="inv-contact-label">Tel:</span> ${settings.businessPhone}</span>
          </div>
          <div class="inv-contact-row">
            <div class="inv-icon-circle" style="width:24px;height:24px;border-radius:50%;background-color:#6d28d9;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <span><span class="inv-contact-label">Location:</span><br/>${settings.businessLocation}</span>
          </div>
        </div>
      </div>
      <div class="inv-meta">
        <div class="inv-ref">${refPrefix}-#${sale.id.substring(0, 8).toUpperCase()}</div>
        <div class="inv-date">Date: ${new Date(sale.date).toLocaleDateString()}</div>
        <span class="inv-badge ${badgeClass}">${badgeText}</span>
      </div>
    </div>

    <hr class="inv-divider"/>

    <!-- CLIENT -->
    <div class="inv-client-label">${isQuotation ? 'Prepared For' : 'Billed To'}</div>
    <div class="inv-client-name">${sale.customer.name}${sale.customer.phone ? `<span style="font-size:14px;font-weight:500;color:#6b7280;margin-left:10px;">${sale.customer.phone}</span>` : ''}</div>

    <!-- TABLE -->
    <table class="inv-table">
      <thead>
        <tr>
          <th>Item Description</th>
          <th class="r">Qty</th>
          <th class="r">Price</th>
          <th class="r">Total</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map(item => `
          <tr>
            <td>${item.name}</td>
            <td class="r">${item.quantity}</td>
            <td class="price">${fmt(item.price)}</td>
            <td class="r">${fmt(item.price * item.quantity)} UGX</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- LOWER: rules + totals -->
    <div class="inv-lower">
      <div class="inv-rules">${rulesHtml}</div>
      <div class="inv-totals">
        <div class="inv-total-row">
          <span class="inv-total-lbl">Subtotal</span>
          <span class="inv-total-val">${fmt(subtotal)} UGX</span>
        </div>
        ${discount > 0 ? `<div class="inv-total-row"><span class="inv-total-lbl">Discount (${discountPercent.toFixed(1)}%)</span><span class="inv-total-val disc">-${fmt(discount)} UGX</span></div>` : ''}
        ${paidRowHtml}
        <div class="inv-total-row grand">
          <span class="inv-total-lbl">${isQuotation ? 'Estimated Total' : 'Grand Total'}</span>
          <span class="inv-total-val">${fmt(grandTotal)} UGX</span>
        </div>
      </div>
    </div>

    <!-- QR -->
    <div class="inv-qr-row">
      <div>
        <img src="${qrUrl}" class="inv-qr-img" alt="QR"/>
        <div class="inv-qr-label">Eko Verify</div>
      </div>
    </div>

    <!-- FOOTER -->
    <div class="inv-footer">
      <img src="${logoUrl}" class="inv-footer-logo" alt="${settings.businessName}"/>
      <div class="inv-footer-name">${settings.businessName.toUpperCase()}</div>
      <div class="inv-footer-divider"></div>
      <div class="inv-footer-tagline">${settings.receiptFooter}</div>
    </div>
  </div>
</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800);}</script>
</body>
</html>`;
}

/* ─── Component ──────────────────────────────────────────────── */
const Invoice: React.FC<InvoiceProps> = ({ isOpen, onClose, sale, settings, isQuotation = false }) => {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const subtotal = sale.subtotal || sale.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = sale.discount || 0;
  const discountPercent = subtotal > 0 ? (discount / subtotal) * 100 : 0;
  const grandTotal = sale.total;
  const paid = sale.amountPaid || 0;
  const balance = grandTotal - paid;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=EKO-${isQuotation ? 'QT' : 'INV'}-${sale.id.substring(0, 8)}&color=0-0-0&bgcolor=255-255-255&margin=2`;
  const refPrefix = isQuotation ? 'QT' : 'INV';
  const badgeLabel = isQuotation ? 'Quotation' : sale.status;
  const badgeClass = isQuotation ? 'inv-badge quote' : (sale.status === 'Paid' ? 'inv-badge paid' : sale.status === 'Partially Paid' ? 'inv-badge partial' : 'inv-badge unpaid');

  /* A4 export */
  const handlePrintA4 = () => {
    const absLogo = window.location.origin + logoAsset;
    const absBg = window.location.origin + bgAsset;
    const html = buildPrintHtml({ bgUrl: absBg, logoUrl: absLogo, qrUrl: qrCodeUrl, isQuotation, sale, settings, subtotal, discount, discountPercent, grandTotal, paid, balance });
    const win = window.open('', '_blank', 'height=900,width=700');
    if (win) { win.document.write(html); win.document.close(); }
  };

  /* Thermal receipt */
  const handleThermal = () => {
    const absLogo = window.location.origin + logoAsset;
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>${isQuotation ? 'Quotation' : 'Thermal Receipt'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
  @page { margin: 0; }
  body { width:80mm; margin:0; padding:1mm; font-family:'Inter',-apple-system,sans-serif; font-size:13px; line-height:1.1; color:#000; background:#fff; font-weight:700; }
  .tc { text-align:center; }
  .tr { text-align:right; }
  .bold { font-weight:900; }
  .dash { border-top:1px dashed #000; margin:1.5mm 0; }
  .logo { height:10mm; display:block; margin:0 auto 1mm; }
  table { width:100%; border-collapse:collapse; margin:1mm 0; }
  th { text-align:left; font-size:10px; border-bottom:1px solid #000; padding:0.5mm 0; }
  td { vertical-align:top; padding:0.5mm 0; font-size:12px; }
  .qr { width:28mm; height:28mm; }
  .row { display:flex; justify-content:space-between; font-size:12px; font-weight:700; }
</style>
</head>
<body>
<div class="tc">
  <img src="${absLogo}" class="logo" onerror="this.style.display='none'"/>
  <div class="bold" style="font-size:16px;">${settings.receiptHeader || settings.businessName}</div>
  <div style="font-size:11px;">Tel: ${settings.businessPhone}</div>
  <div style="font-size:10px;margin-bottom:2mm;">${settings.businessLocation}</div>
</div>
<div class="dash"></div>
<div style="font-size:12px;line-height:1.4;">
  <div>${refPrefix}: #${sale.id.substring(0, 8).toUpperCase()}</div>
  <div>Date: ${new Date(sale.date).toLocaleDateString()}</div>
  <div>Customer: ${sale.customer.name}</div>
</div>
<div class="dash"></div>
<table>
  <thead><tr><th>ITEM</th><th style="text-align:right;width:30px;">QTY</th><th style="text-align:right;width:70px;">TOTAL</th></tr></thead>
  <tbody>
    ${sale.items.map(item => `<tr>
      <td>${item.name}</td>
      <td style="text-align:right;">${item.quantity}</td>
      <td style="text-align:right;">${(item.price * item.quantity).toLocaleString()}</td>
    </tr>`).join('')}
  </tbody>
</table>
<div class="dash"></div>
<div class="row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
${discount > 0 ? `<div class="row"><span>Discount</span><span>-${fmt(discount)}</span></div>` : ''}
${!isQuotation ? `<div class="row"><span>Paid</span><span>${fmt(paid)}</span></div><div class="row"><span>Balance</span><span>${fmt(balance)}</span></div>` : ''}
<div class="row bold" style="font-size:14px;margin-top:1mm;">
  <span>${isQuotation ? 'TOTAL' : 'TOTAL'}</span><span>${fmt(grandTotal)} UGX</span>
</div>
${sale.rules && sale.rules.length > 0 ? `<div class="dash"></div><div style="font-size:10px;"><div class="bold" style="margin-bottom:0.5mm;">RULES & TERMS:</div>${sale.rules.map(r => `• ${r}`).join('<br/>')}</div>` : ''}
<div class="dash"></div>
<div class="tc">
  <img src="${qrCodeUrl}" class="qr"/>
  <div style="font-size:8px;font-weight:800;letter-spacing:0.1em;">SCAN TO VERIFY</div>
</div>
<div class="tc" style="font-size:10px;margin-top:1.5mm;">${settings.receiptFooter}</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),600);}</script>
</body>
</html>`;
    const win = window.open('', '_blank', 'width=420,height=640');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isQuotation ? 'Quotation Detail' : 'Invoice Detail'}>
      <style>{invoiceStyles(bgAsset)}</style>

      {/* ── On-screen preview ── */}
      <div className="bg-gray-100 p-2 sm:p-4 rounded-xl overflow-x-hidden">
        <div className="inv-page shadow-xl mx-auto rounded-2xl overflow-hidden" style={{ maxWidth: 720 }} ref={invoiceRef}>
          <div className="inv-bg" />
          <div className="inv-body">

            {/* HEADER */}
            <div className="inv-header">
              <div>
                <img src={logoAsset} className="inv-logo" alt="Logo" />
                <div className="inv-contact">
                  <div className="inv-contact-row">
                    <span className="inv-contact-icon"><EmailIcon /></span>
                    <span><span className="inv-contact-label">Email:</span> <span className="inv-contact-text">{settings.businessEmail}</span></span>
                  </div>
                  <div className="inv-contact-row">
                    <span className="inv-contact-icon"><PhoneIcon /></span>
                    <span><span className="inv-contact-label">Tel:</span> <span className="inv-contact-text">{settings.businessPhone}</span></span>
                  </div>
                  <div className="inv-contact-row">
                    <span className="inv-contact-icon"><LocationIcon /></span>
                    <span><span className="inv-contact-label">Location:</span><br /><span className="inv-contact-text">{settings.businessLocation}</span></span>
                  </div>
                </div>
              </div>
              <div className="inv-meta">
                <div className="inv-ref">{refPrefix}-#{sale.id.substring(0, 8).toUpperCase()}</div>
                <div className="inv-date">Date: {new Date(sale.date).toLocaleDateString()}</div>
                <span className={badgeClass}>{badgeLabel}</span>
              </div>
            </div>

            <hr className="inv-divider" />

            {/* CLIENT */}
            <div className="inv-client-label">{isQuotation ? 'Prepared For' : 'Billed To'}</div>
            <div className="inv-client-name">
              {sale.customer.name}
              {sale.customer.phone && (
                <span style={{ fontSize: 14, fontWeight: 500, color: '#4b5563', marginLeft: 10 }}>
                  {sale.customer.phone}
                </span>
              )}
            </div>

            {/* TABLE */}
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Item Description</th>
                  <th className="r">Qty</th>
                  <th className="r">Price</th>
                  <th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td className="r">{item.quantity}</td>
                    <td className="price">{fmt(item.price)}</td>
                    <td className="r">{fmt(item.price * item.quantity)} UGX</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* LOWER: rules + totals */}
            <div className="inv-lower">
              <div className="inv-rules">
                {sale.rules && sale.rules.length > 0 && (
                  <>
                    <div className="inv-rules-label">Invoice Terms &amp; Rules</div>
                    <ul>{sale.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  </>
                )}
              </div>
              <div className="inv-totals">
                <div className="inv-total-row">
                  <span className="inv-total-lbl">Subtotal</span>
                  <span className="inv-total-val">{fmt(subtotal)} UGX</span>
                </div>
                {discount > 0 && (
                  <div className="inv-total-row">
                    <span className="inv-total-lbl">Discount ({discountPercent.toFixed(1)}%)</span>
                    <span className="inv-total-val disc">-{fmt(discount)} UGX</span>
                  </div>
                )}
                {!isQuotation && (
                  <>
                    <div className="inv-total-row">
                      <span className="inv-total-lbl">Paid</span>
                      <span className="inv-total-val paid-c">{fmt(paid)} UGX</span>
                    </div>
                    {balance > 0 && (
                      <div className="inv-total-row">
                        <span className="inv-total-lbl">Balance</span>
                        <span className="inv-total-val disc">{fmt(balance)} UGX</span>
                      </div>
                    )}
                  </>
                )}
                <div className="inv-total-row grand">
                  <span className="inv-total-lbl">{isQuotation ? 'Estimated Total' : 'Grand Total'}</span>
                  <span className="inv-total-val">{fmt(grandTotal)} UGX</span>
                </div>
              </div>
            </div>

            {/* QR */}
            <div className="inv-qr-row">
              <div>
                <img src={qrCodeUrl} className="inv-qr-img" alt="QR" />
                <div className="inv-qr-label">Eko Verify</div>
              </div>
            </div>

            {/* FOOTER */}
            <div className="inv-footer">
              <img src={logoAsset} className="inv-footer-logo" alt={settings.businessName} />
              <div className="inv-footer-name">{settings.businessName.toUpperCase()}</div>
              <div className="inv-footer-divider" />
              <div className="inv-footer-tagline">{settings.receiptFooter}</div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="mt-4 flex flex-wrap justify-between items-center gap-3 px-2">
        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest flex-1">
          {settings.businessName} Management System
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleThermal}
            className="flex items-center bg-gray-100 text-gray-900 px-4 py-2.5 rounded-xl shadow-sm hover:bg-gray-200 transition-all font-black uppercase text-[10px] tracking-widest border border-gray-200"
          >
            <PrintIcon className="w-3.5 h-3.5 mr-2" />
            Receipt (Thermal)
          </button>
          <button
            onClick={handlePrintA4}
            className="flex items-center bg-gray-900 text-yellow-400 px-6 py-2.5 rounded-xl shadow-xl hover:bg-black transition-all transform hover:-translate-y-0.5 font-black uppercase text-[10px] tracking-widest"
          >
            <PrintIcon className="w-4 h-4 mr-2" />
            Export to PDF
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default Invoice;
