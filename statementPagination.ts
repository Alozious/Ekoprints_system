/** Lay out explicit paper sheets so screen preview and print share page boundaries. */
export async function paginateStatement(doc:Document):Promise<void>{
 if(doc.querySelector('.statement-page'))return;
 const source=[...doc.body.children].filter(n=>n.tagName!=='SCRIPT');
 const style=doc.createElement('style');style.textContent=`
 @page{size:A4 landscape;margin:0}
 html,body{margin:0!important;padding:0!important;background:#e5e7eb;font-family:Arial,sans-serif}
 .statement-page{width:297mm;height:210mm;padding:10mm;box-sizing:border-box;position:relative;background:white;margin:8mm auto;box-shadow:0 2px 12px #0002;break-after:page;page-break-after:always;overflow:hidden}
 .statement-page:last-child{break-after:auto;page-break-after:auto}
 .statement-page-content{height:180mm;overflow:hidden}
 .statement-page-number{position:absolute;bottom:5mm;left:10mm;right:10mm;border-top:1px solid #d1d5db;padding-top:2mm;display:flex;justify-content:space-between;font:9px Arial,sans-serif;color:#64748b}
 .statement-page .chart-cover{break-after:auto!important;page-break-after:auto!important;display:flex;flex-direction:column;min-height:0}
 .statement-page .cover-grid{flex:1;min-height:0;grid-template-rows:repeat(2,minmax(0,1fr))}
 .statement-page .cover-grid article{min-height:0}
 .statement-page table{width:100%;margin:0;border-collapse:collapse}
 .statement-page .details{margin-top:5px;margin-bottom:10px}
 .statement-page tr{break-inside:avoid;page-break-inside:avoid}
 .statement-page .page-continuation{font-size:10px;color:#64748b;margin:0 0 5mm}
 @media print{html,body{background:white!important}.statement-page{margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
 `;doc.head.append(style);doc.body.replaceChildren();
 const pages:HTMLElement[]=[];let content:HTMLElement;
 function newPage(){const page=doc.createElement('section');page.className='statement-page';content=doc.createElement('div');content.className='statement-page-content';page.append(content);doc.body.append(page);pages.push(page);}
 newPage();
 const overflow=()=>content.scrollHeight>content.clientHeight+1;
 function appendBlock(block:HTMLElement){content.append(block);if(overflow()&&content.children.length>1){block.remove();newPage();content.append(block);}}
 let processed=0;
 async function paginateTable(source:HTMLTableElement){
  let table:HTMLTableElement|null=null,body:HTMLTableSectionElement|null=null;
  const make=()=>{table=source.cloneNode(false) as HTMLTableElement;table.removeAttribute('id');if(source.caption)table.append(source.caption.cloneNode(true));if(source.tHead)table.append(source.tHead.cloneNode(true));body=doc.createElement('tbody');table.append(body);content.append(table);};
  const rows=[...source.tBodies].flatMap(section=>[...section.rows]);
  for(const original of rows){
   const nested=original.querySelector('table');
   if(nested){table=null;body=null;await paginateTable(nested);continue;}
   if(!table)make();
   const row=original.cloneNode(true) as HTMLTableRowElement;body!.append(row);
   if(overflow()){
    row.remove();if(!body!.rows.length)table!.remove();
    if(content.children.length){newPage();make();body!.append(row);}else{if(!table!.isConnected)make();body!.append(row);}
    // A single unusually tall row must remain readable within its own sheet.
    if(overflow()){row.style.fontSize='8px';row.querySelectorAll('td,th').forEach(cell=>(cell as HTMLElement).style.padding='3px');}
   }
   if(++processed%150===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
 }
 for(const node of source){
  const element=node as HTMLElement;
  if(element.matches('table')){await paginateTable(element as HTMLTableElement);continue;}
  if(element.classList.contains('chart-cover')){
   content.append(element);
   const available=content.clientHeight-(element.offsetTop-content.offsetTop);
   if(element.offsetHeight>available)element.style.height=Math.max(0,available-2)+'px';
   newPage();continue;
  }
  appendBlock(element);
 }
 if(pages.length>1&&!content.children.length){pages.pop()!.remove();}
 pages.forEach((page,index)=>{const footer=doc.createElement('footer');footer.className='statement-page-number';const name=doc.createElement('span');name.textContent='Statement of Accounts · UGX';const number=doc.createElement('span');number.textContent=`Page ${index+1} of ${pages.length}`;footer.append(name,number);page.append(footer);page.setAttribute('aria-label',`Page ${index+1} of ${pages.length}`);});
}
