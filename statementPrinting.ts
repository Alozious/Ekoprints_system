export async function downloadStatementPdf(doc:Document,onProgress:(page:number,total:number)=>void=()=>{}):Promise<void>{
 const pages=[...doc.querySelectorAll<HTMLElement>('.statement-page')];
 if(!pages.length)throw new Error('Statement pages are not ready. Generate the statement again.');
 const [{jsPDF},{default:html2canvas}]=await Promise.all([import('jspdf'),import('html2canvas')]);
 const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 pdf.setProperties({title:doc.title||'Statement of Accounts',creator:'Eko Prints'});
 for(let i=0;i<pages.length;i++){
  onProgress(i+1,pages.length);
  await new Promise(resolve=>setTimeout(resolve,0));
  const canvas=await html2canvas(pages[i],{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:true,windowWidth:1200,windowHeight:900});
  if(i)pdf.addPage('a4','landscape');
  pdf.addImage(canvas.toDataURL('image/jpeg',0.95),'JPEG',0,0,297,210,undefined,'FAST');
  canvas.width=0;canvas.height=0;
 }
 // The temporary download link belongs to the statement window, preserving normal browser downloads.
 const blob=pdf.output('blob');const url=URL.createObjectURL(blob);
 const link=doc.createElement('a');link.href=url;link.download='Eko-Prints-Statement.pdf';doc.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function addStatementPrintControls(doc:Document):void{
 const win=doc.defaultView;if(!win||doc.querySelector('.statement-print-tools'))return;
 const style=doc.createElement('style');style.textContent=`.statement-print-tools{position:sticky;top:0;z-index:1000;padding:12px 18px;background:#111827;color:white;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font:13px Arial,sans-serif}.statement-print-tools button{background:#facc15;color:#111827;border:0;border-radius:8px;padding:10px 16px;font-weight:bold;cursor:pointer}.statement-print-tools button:disabled{opacity:.6;cursor:wait}.statement-print-tools .print-status{flex:1}.statement-print-tools .print-error{color:#fda4af}@media print{.statement-print-tools{display:none!important}}`;doc.head.append(style);
 const toolbar=doc.createElement('div');toolbar.className='statement-print-tools';
 const pdfButton=doc.createElement('button');pdfButton.textContent='Download printable PDF';pdfButton.type='button';
 const printButton=doc.createElement('button');printButton.textContent='Print';printButton.type='button';
 const status=doc.createElement('span');status.className='print-status';status.setAttribute('role','status');status.textContent='A4 landscape · Open the downloaded PDF to print.';
 toolbar.append(pdfButton,printButton,status);doc.body.prepend(toolbar);
 let busy=false;
 const download=async()=>{
  if(busy)return;busy=true;pdfButton.disabled=true;printButton.disabled=true;status.classList.remove('print-error');pdfButton.setAttribute('aria-busy','true');
  try{await downloadStatementPdf(doc,(page,total)=>{pdfButton.textContent='Preparing PDF...';status.textContent=`Preparing page ${page} of ${total}...`;});status.textContent='PDF downloaded. Open it and press Ctrl+P to print.';}
  catch(error){status.classList.add('print-error');status.textContent=error instanceof Error?error.message:'Unable to create the PDF. Please try again.';}
  finally{busy=false;pdfButton.disabled=false;printButton.disabled=false;pdfButton.textContent='Download printable PDF';pdfButton.removeAttribute('aria-busy');}
 };
 const print=async()=>{
  if(busy)return;
  let started=false;const before=()=>{started=true;};win.addEventListener('beforeprint',before,{once:true});
  try{win.focus();win.print();}catch{/* Fall back to a real PDF when embedded printing is unavailable. */}
  setTimeout(()=>{win.removeEventListener('beforeprint',before);if(!started)void download();},500);
 };
 pdfButton.addEventListener('click',()=>{void download();});printButton.addEventListener('click',()=>{void print();});
 doc.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='p'){event.preventDefault();void print();}});
}
