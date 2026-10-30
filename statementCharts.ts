import {dashboardInsights} from './dashboardInsights.ts';
import type {StatementInput} from './statementExport.ts';
const escape=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const money=(n:number)=>new Intl.NumberFormat('en-UG',{maximumFractionDigits:0}).format(n)+' UGX';
const compact=(n:number)=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
const text=(x:number,y:number,s:unknown,size=10,fill='#334155',anchor='start')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${escape(s)}</text>`;
const svg=(body:string,label:string)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 215" role="img" aria-label="${escape(label)}" style="width:100%;height:100%;font-family:Arial,sans-serif">${body}</svg>`;
function ranks(rows:{name:string;value:number;extra?:string}[],color:string,label:string){
 if(!rows.length)return svg(text(20,70,'No activity in this selection.'),label);
 const max=Math.max(1,...rows.map(r=>r.value));
 return svg(rows.slice(0,5).map((r,i)=>{const y=20+i*40;const title=r.name||'Uncategorised';const name=title.length>58?title.slice(0,55)+'...':title;return text(8,y,name,11)+text(490,y,money(r.value),10,'#0f172a','end')+`<rect x="8" y="${y+8}" width="480" height="8" rx="3" fill="#f1f5f9"/><rect x="8" y="${y+8}" width="${Math.max(0,r.value/max*480)}" height="8" rx="3" fill="${color}"/>`+(r.extra?text(8,y+30,r.extra,9,'#64748b'):'');}).join(''),label);
}
export function statementCharts(input:StatementInput):string{
 const {sales,expenses,stockTransactions,filter,module,admin}=input;
 // A monthly cover keeps long statements readable; shorter selections use daily periods.
 const monthly=filter.period==='all'||filter.period==='year'||filter.period==='custom'&&!!filter.end&&!!filter.start&&new Date(filter.end).getTime()-new Date(filter.start).getTime()>62*86400000;
 const d=dashboardInsights(sales,expenses,stockTransactions,filter,module,monthly);
 const rows=d.trend;
 // Keep every period in the statement tables; combine only the cover plot for very long histories.
 const step=Math.max(1,Math.ceil(rows.length/36));
 const plot=Array.from({length:Math.ceil(rows.length/step)},(_,i)=>{const group=rows.slice(i*step,(i+1)*step);return {label:group[0].label,cash:group.reduce((n,r)=>n+r.cash,0),cost:group.reduce((n,r)=>n+r.expenses+(admin?r.cogs+r.adjustments:0),0),net:group.reduce((n,r)=>n+(admin?r.net:r.cashNet),0)};});
 const min=Math.min(0,...plot.flatMap(r=>[r.cash,r.cost,r.net])),max=Math.max(1,...plot.flatMap(r=>[r.cash,r.cost,r.net]));
 const y=(v:number)=>170-(v-min)/(max-min)*140,zero=y(0),width=440/Math.max(1,plot.length);
 let trend=[0,0.5,1].map(f=>{const v=min+(max-min)*f;return `<line x1="50" x2="490" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/>`+text(45,y(v)+3,compact(v),9,'#64748b','end');}).join('');
 trend+=plot.map((r,i)=>{const x=50+i*width;return `<rect x="${x+width*.12}" y="${Math.min(zero,y(r.cash))}" width="${width*.3}" height="${Math.abs(zero-y(r.cash))}" fill="#2563eb"/><rect x="${x+width*.5}" y="${Math.min(zero,y(r.cost))}" width="${width*.3}" height="${Math.abs(zero-y(r.cost))}" fill="#fb7185"/>`+(i%Math.max(1,Math.ceil(plot.length/8))===0?text(x+width/2,189,r.label,8,'#64748b','middle'):'');}).join('');
 trend+=`<polyline points="${plot.map((r,i)=>`${50+(i+.5)*width},${y(r.net)}`).join(' ')}" fill="none" stroke="#059669" stroke-width="2.5"/>`;
 trend+=text(50,209,'Blue: collected    Pink: costs    Green: '+(admin?'net profit / loss':'net cash'),10);
 const total=d.totals,cost=total.operatingExpenses+(admin?total.cogs+total.adjustments:0),net=admin?total.netProfit:total.cashCollected-total.operatingExpenses;
 const expenseTotal=d.categories.reduce((n,r)=>n+r.value,0);
 const expenseRows=d.categories.slice(0,5).map(r=>({...r,extra:expenseTotal?(r.value/expenseTotal*100).toFixed(1)+'% of expenses':''}));
 const items=d.items.slice(0,5).map(r=>({...r,extra:r.quantity+' units recorded'}));
 const departments=d.departments;
 const maxDepartment=Math.max(1,...departments.flatMap(r=>[r.cash,admin?r.costs:r.expenses]));
 const departmentsSvg=svg(departments.length?departments.map((r,i)=>{const spacing=190/Math.max(1,departments.length),y=15+i*spacing;return text(5,y,r.name,10)+`<rect x="110" y="${y-9}" width="${Math.max(0,r.cash/maxDepartment*270)}" height="8" fill="#2563eb"/><rect x="110" y="${y+2}" width="${Math.max(0,(admin?r.costs:r.expenses)/maxDepartment*270)}" height="8" fill="#fb7185"/>`+text(490,y+4,money(admin?r.net:r.cash-r.expenses),9,admin?r.net<0?'#be123c':'#047857':'#334155','end');}).join('')+text(5,210,'Blue: collected   Pink: costs   Right: '+(admin?'net profit / loss':'net cash'),9):text(20,70,'No department activity.'),'Department performance');
 return `<section class="chart-cover" aria-label="Statement graphs"><div class="cover-totals"><span>Cash collected <strong>${money(total.cashCollected)}</strong></span><span>${admin?'Total costs':'Operating expenses'} <strong>${money(cost)}</strong></span><span>${admin?'Net profit / loss':'Net cash flow'} <strong>${money(net)}</strong></span></div><div class="cover-grid"><article><h2>Collections against costs</h2><p>${monthly?'Monthly':'Daily'} results${step>1?' · '+step+' periods combined per plot point':''} · UGX</p>${svg(trend,'Collections, costs and net results')}</article><article><h2>Largest operating expenses</h2><p>Top 5 categories · UGX</p>${ranks(expenseRows,'#fb7185','Expense rankings')}</article><article><h2>Top selling items</h2><p>Top 5 by allocated invoice value · UGX</p>${ranks(items,'#2563eb','Top selling items')}</article><article><h2>Department performance</h2><p>Collections, costs and results · UGX</p>${departmentsSvg}</article></div></section>`;
}
export const statementChartStyles=`.chart-cover{height:148mm;box-sizing:border-box;break-after:page;page-break-after:always;break-inside:avoid}.cover-totals{display:flex;gap:12px;margin:4px 0 8px}.cover-totals span{flex:1;padding:8px;background:#f1f5f9;border-radius:6px;font-size:10px}.cover-totals strong{display:block;margin-top:4px;font-size:14px}.cover-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:61mm 61mm;gap:8px}.cover-grid article{min-width:0;border:1px solid #e2e8f0;border-radius:8px;padding:8px;box-sizing:border-box;overflow:hidden}.cover-grid h2{font-size:12px;margin:0 0 3px}.cover-grid p{font-size:9px;color:#64748b;margin:0 0 2px}.cover-grid svg{max-height:calc(100% - 30px)}@media print{.chart-cover{print-color-adjust:exact;-webkit-print-color-adjust:exact}}`;
