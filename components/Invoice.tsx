
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

  .inv-bg {
    position: fixed;
    inset: 0;
    background-image: url('${bgUrl}');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    opacity: 0.15;
    pointer-events: none;
    z-index: 0;
  }

  .inv-body {
    position: relative;
    z-index: 1;
    padding: 60px 45px 35px;
  }

  /* ── NEW HEADER ── */
  .inv-header-top {
    display: flex;
    align-items: flex-start;
    gap: 0;
    margin-bottom: 24px;
  }
  .inv-logo-wrap { flex-shrink: 0; padding-right: 24px; }
  .inv-logo { height: 90px; width: auto; object-fit: contain; display: block; }
  .inv-vdivider {
    width: 2px;
    align-self: stretch;
    background: #cbd5e1;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .inv-contact-grid {
    display: flex;
    flex-wrap: nowrap;
    justify-content: space-between;
    gap: 0;
    padding-left: 24px;
    align-items: flex-start;
    flex: 1;
  }
  .inv-contact-block {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 180px;
  }
  .inv-contact-icon {
    width: 28px; height: 28px; border-radius: 50%;
    background-color: #6d28d9; display: flex; align-items: center; justify-content: center;
    color: #fff; flex-shrink: 0; margin-top: 2px;
  }
  .inv-contact-icon svg { width: 14px; height: 14px; }
  .inv-contact-info { display: flex; flex-direction: column; }
  .inv-contact-label { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; color: #6d28d9; line-height: 1.4; }
  .inv-contact-value { font-size: 14px; font-weight: 600; color: #374151; line-height: 1.4; }

  /* ── BADGE ROW ── */
  .inv-badge-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 18px;
  }
  .inv-badge {
    display: inline-block;
    padding: 14px 60px;
    background: #f59e0b;
    color: #1c1917;
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border-radius: 8px;
  }
  .inv-badge.paid   { background: #d1fae5; color: #065f46; }
  .inv-badge.partial{ background: #fef3c7; color: #92400e; }
  .inv-badge.unpaid { background: #fee2e2; color: #991b1b; }
  .inv-badge.quote  { background: #fbbf24; color: #1c1917; }
  .inv-meta { text-align: right; }
  .inv-ref {
    font-size: 28px;
    font-weight: 900;
    color: #111827;
    letter-spacing: -0.5px;
    line-height: 1;
  }
  .inv-date { font-size: 14px; color: #4b5563; font-weight: 600; margin-top: 6px; }

  /* ── DIVIDER ── */
  .inv-divider { border: none; border-top: 1px solid rgba(0,0,0,0.12); margin: 0 0 22px; }

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
  .inv-table th.desc { width: 45%; }
  .inv-table td.desc { width: 45%; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; }

  /* ── LOWER SECTION ── */
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

  .inv-totals { min-width: 280px; }
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
    padding-top: 12px;
  }
  .inv-total-row.grand .inv-total-lbl { font-size: 15px; font-weight: 900; color: #111827; }
  .inv-total-row.grand .inv-total-val { font-size: 22px; font-weight: 900; color: #111827; letter-spacing: 2px; }
  .inv-total-lbl { font-weight: 600; }
  .inv-total-val { font-weight: 800; color: #111827; }
  .inv-total-val.disc { color: #dc2626; }
  .inv-total-val.paid-c { color: #059669; }
  .inv-total-val.tax { color: #6d28d9; }

  /* ── QR + FOOTER ── */
  .inv-qr-row { display: flex; align-items: center; gap: 10px; margin-bottom: 30px; }
  .inv-qr-img { width: 75px; height: 75px; border: 1px solid #e5e7eb; border-radius: 6px; }
  .inv-qr-label { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #6d28d9; margin-top: 4px; text-align: center; }

  .inv-footer {
    text-align: center;
    border-top: 1px solid rgba(0,0,0,0.1);
    padding-top: 20px;
    margin-top: 30px;
  }
  .inv-footer-tagline { font-size: 13px; color: #4b5563; font-weight: 600; }

  @media print {
    @page { margin: 0; size: A4; }
    body { margin: 0; background: transparent !important; }
    .inv-page { min-height: 100vh; }
    .inv-bg { opacity: 0.15 !important; }
    .no-print { display: none !important; }
    .inv-pn { position: fixed; bottom: 12px; right: 18px; font-size: 10px; color: #9ca3af; font-family: Inter, sans-serif; z-index: 1000; }
  }
`;

/* ─── Helper: build print-ready HTML ──────────────────────────── */
function buildPrintHtml(params: {
  bgUrl: string; logoUrl: string; qrUrl: string;
  isQuotation: boolean; sale: Sale & { customer: Customer };
  settings: SystemSettings;
  subtotal: number; discount: number; discountPercent: number;
  taxPercent: number; taxAmount: number;
  grandTotal: number; paid: number; balance: number;
}) {
  const { bgUrl, logoUrl, qrUrl, isQuotation, sale, settings, subtotal, discount, discountPercent, taxPercent, taxAmount, grandTotal, paid, balance } = params;

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
      <span class="inv-total-val paid-c">${fmt(paid)}</span>
    </div>
    ${balance > 0 ? `<div class="inv-total-row"><span class="inv-total-lbl">Balance</span><span class="inv-total-val disc">${fmt(balance)}</span></div>` : ''}
  ` : '';

  const taxRowHtml = `
    <div class="inv-total-row">
      <span class="inv-total-lbl">Tax${taxPercent > 0 ? ` (${taxPercent}%)` : ''}</span>
      <span class="inv-total-val tax">${taxPercent > 0 ? fmt(taxAmount) : 'N/A'}</span>
    </div>
  `;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>${settings.businessName} ${isQuotation ? 'Quotation' : 'Invoice'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  body { margin:0; padding:0; background:#fff; }
  ${invoiceStyles(bgUrl)}
</style>
</head>
<body>
<div class="inv-page">
  <div class="inv-bg"></div>
  <div class="inv-body">
    <!-- HEADER TOP: Logo | divider | contacts -->
    <div class="inv-header-top">
      <div class="inv-logo-wrap">
        <img src="${logoUrl}" class="inv-logo" alt="Logo"/>
      </div>
      <div class="inv-vdivider"></div>
      <div class="inv-contact-grid">
        <div class="inv-contact-block">
          <div class="inv-contact-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 21 17z"/></svg>
          </div>
          <div class="inv-contact-info">
            <span class="inv-contact-label">Tel</span>
            ${settings.businessPhone.split('/').map((p: string) => `<span class="inv-contact-value">${p.trim()}</span>`).join('')}
          </div>
        </div>
        <div class="inv-contact-block">
          <div class="inv-contact-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <div class="inv-contact-info">
            <span class="inv-contact-label">Email</span>
            <span class="inv-contact-value">${settings.businessEmail}</span>
          </div>
        </div>
        <div class="inv-contact-block">
          <div class="inv-contact-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div class="inv-contact-info">
            <span class="inv-contact-label">Location</span>
            ${settings.businessLocation.split(',').reduce((acc: string[], part: string, i: number, arr: string[]) => {
              if (i === 0) acc.push(part.trim());
              else if (i === 1) acc.push(part.trim());
              else acc[acc.length - 1] += ', ' + part.trim();
              return acc;
            }, []).map((line: string) => `<span class="inv-contact-value">${line}</span>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- BADGE ROW: badge left, ref+date right -->
    <div class="inv-badge-row">
      <span class="inv-badge ${badgeClass}">${badgeText}</span>
      <div class="inv-meta">
        <div class="inv-ref">${refPrefix}-#${sale.id.substring(0, 8).toUpperCase()}</div>
        <div class="inv-date">Date: ${new Date(sale.date).toLocaleDateString()}</div>
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
          <th class="desc">Item Description</th>
          <th class="r">Qty</th>
          <th class="r">Price</th>
          <th class="r">Total (UGX)</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map(item => `
          <tr>
            <td class="desc">${item.name}</td>
            <td class="r">${item.quantity}</td>
            <td class="price">${fmt(item.price)}</td>
            <td class="r">${fmt(item.price * item.quantity)}</td>
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
          <span class="inv-total-val">${fmt(subtotal)}</span>
        </div>
        ${discount > 0 ? `<div class="inv-total-row"><span class="inv-total-lbl">Discount (${discountPercent.toFixed(1)}%)</span><span class="inv-total-val disc">-${fmt(discount)}</span></div>` : ''}
        ${taxRowHtml}
        ${paidRowHtml}
        <div class="inv-total-row grand">
          <span class="inv-total-lbl">${isQuotation ? 'Estimated Total' : 'Grand Total'}</span>
          <span class="inv-total-val">${fmt(grandTotal)}</span>
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
      <div class="inv-footer-tagline">Thank you for choosing ${settings.businessName}!</div>
    </div>
  </div>
</div>
<script>
window.onload=function(){
  setTimeout(function(){
    var pg=document.querySelector('.inv-page');
    var h=pg?Math.max(pg.scrollHeight,pg.offsetHeight):0;
    var a4=1122;
    var n=Math.max(1,Math.ceil(h/a4));
    if(n>1){
      var body=document.querySelector('.inv-body');
      var children=Array.prototype.slice.call(body.children);
      var accumulated=0;
      var inserted=0;
      children.forEach(function(child){
        var rect=child.getBoundingClientRect();
        var childHeight=rect.height;
        accumulated+=childHeight;
        var pageBoundary=0;
        while(accumulated > (inserted+1)*a4){
          pageBoundary=(inserted+1)*a4;
          var marker=document.createElement('div');
          marker.style.cssText='page-break-before:always;height:0;overflow:hidden;';
          var pageNum=document.createElement('div');
          pageNum.style.cssText='position:fixed;bottom:12px;right:18px;font-size:10px;color:#9ca3af;font-family:Inter,sans-serif;z-index:1000;';
          pageNum.textContent='Page '+(inserted+1)+' of '+n;
          marker.appendChild(pageNum);
          child.parentNode.insertBefore(marker, child);
          inserted++;
        }
      });
    }
    window.print();
    setTimeout(function(){window.close();},1000);
  },500);
};
</script>
</body>
</html>`;
}

/* ─── Component ──────────────────────────────────────────────── */
const Invoice: React.FC<InvoiceProps> = ({ isOpen, onClose, sale, settings, isQuotation = false }) => {
  const invoiceRef = React.useRef<HTMLDivElement>(null);
  const subtotal = sale.subtotal || sale.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discount = sale.discount || 0;
  const discountPercent = subtotal > 0 ? (discount / subtotal) * 100 : 0;
  const taxPercent = sale.taxPercent || 0;
  const taxAmount = subtotal > 0 ? ((subtotal - discount) * taxPercent / 100) : 0;
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
    const html = buildPrintHtml({ bgUrl: absBg, logoUrl: absLogo, qrUrl: qrCodeUrl, isQuotation, sale, settings, subtotal, discount, discountPercent, taxPercent, taxAmount, grandTotal, paid, balance });
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
${taxPercent > 0 ? `<div class="row"><span>Tax (${taxPercent}%)</span><span>${fmt(taxAmount)}</span></div>` : ''}
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
<div class="tc" style="font-size:10px;margin-top:1.5mm;">Thank you for choosing ${settings.businessName}!</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),600);}</script>
</body>
</html>`;
    const win = window.open('', '_blank', 'width=420,height=640');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isQuotation ? 'Quotation Detail' : 'Invoice Detail'}>
      <style>{invoiceStyles(bgAsset)}</style>

      {/* On-screen preview */}
      <div className="bg-gray-100 p-2 sm:p-4 rounded-xl overflow-x-hidden">
        <div className="inv-page shadow-xl mx-auto rounded-2xl overflow-hidden" style={{ maxWidth: 720 }} ref={invoiceRef}>
          <div className="inv-bg" />
          <div className="inv-body">

            {/* HEADER TOP: Logo | divider | contacts */}
            <div className="inv-header-top">
              <div className="inv-logo-wrap">
                <img src={logoAsset} className="inv-logo" alt="Logo" />
              </div>
              <div className="inv-vdivider" />
              <div className="inv-contact-grid">
                <div className="inv-contact-block">
                  <div className="inv-contact-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 21 17z"/></svg>
                  </div>
                  <div className="inv-contact-info">
                    <span className="inv-contact-label">Tel</span>
                    {settings.businessPhone.split('/').map((p, i) => (
                      <span key={i} className="inv-contact-value">{p.trim()}</span>
                    ))}
                  </div>
                </div>
                <div className="inv-contact-block">
                  <div className="inv-contact-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <div className="inv-contact-info">
                    <span className="inv-contact-label">Email</span>
                    <span className="inv-contact-value">{settings.businessEmail}</span>
                  </div>
                </div>
                <div className="inv-contact-block">
                  <div className="inv-contact-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div className="inv-contact-info">
                    <span className="inv-contact-label">Location</span>
                    {settings.businessLocation.split(',').reduce((acc: string[], part, i) => {
                      if (i === 0) acc.push(part.trim());
                      else if (i === 1) acc.push(part.trim());
                      else acc[acc.length - 1] += ', ' + part.trim();
                      return acc;
                    }, []).map((line, i) => (
                      <span key={i} className="inv-contact-value">{line}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* BADGE ROW */}
            <div className="inv-badge-row">
              <span className={badgeClass}>{badgeLabel}</span>
              <div className="inv-meta">
                <div className="inv-ref">{refPrefix}-#{sale.id.substring(0, 8).toUpperCase()}</div>
                <div className="inv-date">Date: {new Date(sale.date).toLocaleDateString()}</div>
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
                  <th className="desc">Item Description</th>
                  <th className="r">Qty</th>
                  <th className="r">Price</th>
                  <th className="r">Total (UGX)</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, i) => (
                  <tr key={i}>
                    <td className="desc">{item.name}</td>
                    <td className="r">{item.quantity}</td>
                    <td className="price">{fmt(item.price)}</td>
                    <td className="r">{fmt(item.price * item.quantity)}</td>
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
                  <span className="inv-total-val">{fmt(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="inv-total-row">
                    <span className="inv-total-lbl">Discount ({discountPercent.toFixed(1)}%)</span>
                    <span className="inv-total-val disc">-{fmt(discount)}</span>
                  </div>
                )}
                <div className="inv-total-row">
                  <span className="inv-total-lbl">Tax{taxPercent > 0 ? ` (${taxPercent}%)` : ''}</span>
                  <span className="inv-total-val tax">{taxPercent > 0 ? fmt(taxAmount) : 'N/A'}</span>
                </div>
                {!isQuotation && (
                  <>
                    <div className="inv-total-row">
                      <span className="inv-total-lbl">Paid</span>
                      <span className="inv-total-val paid-c">{fmt(paid)}</span>
                    </div>
                    {balance > 0 && (
                      <div className="inv-total-row">
                        <span className="inv-total-lbl">Balance</span>
                        <span className="inv-total-val disc">{fmt(balance)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="inv-total-row grand">
                  <span className="inv-total-lbl">{isQuotation ? 'Estimated Total' : 'Grand Total'}</span>
                  <span className="inv-total-val">{fmt(grandTotal)}</span>
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
              <div className="inv-footer-tagline">Thank you for choosing {settings.businessName}!</div>
            </div>

          </div>
        </div>
      </div>

      {/* Action buttons */}
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
