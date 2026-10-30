import type {Sale,Expense,StockTransaction} from './types.ts';
import {businessDay,inPeriod,profitSummary,moduleShare,saleDepartment} from './reportAccounting.ts';
import type {AccountingFilter,DepartmentFilter} from './reportAccounting.ts';
import {department} from './stockMath.ts';
export function dashboardInsights(sales:Sale[],expenses:Expense[],movements:StockTransaction[],requested:AccountingFilter,module:DepartmentFilter,monthly:boolean){
 const filter={...requested,now:requested.now||new Date()};
 const dates=[...sales.filter(s=>!s.voidedAt&&!s.internalComplementary&&moduleShare(s,module)>0).flatMap(s=>[s.date,...(s.payments||[]).map(p=>p.date)]),...expenses.filter(e=>module==='all'||department(e.module)===module).map(e=>e.date),...movements.filter(m=>'type'in m&&m.type!=='Opening'&&(module==='all'||m.module===module)).map(m=>m.date)].filter(d=>inPeriod(d,filter)).map(businessDay).sort();
 const today=businessDay(filter.now);
 const start=filter.period==='custom'?filter.start||today:filter.period==='today'?today:filter.period==='yesterday'?businessDay(new Date(new Date(today+'T12:00:00Z').getTime()-86400000)):filter.period==='month'?today.slice(0,7)+'-01':filter.period==='year'?today.slice(0,4)+'-01-01':dates[0]||today;
 const end=filter.period==='custom'?(filter.dateMode==='range'?filter.end||start:start):filter.period==='yesterday'?start:filter.period==='today'?today:(dates[dates.length-1]||today)>today?dates[dates.length-1]:today;
 const trend=[];
 for(let cursor=start;cursor<=end;){
  const key=cursor.slice(0,monthly?7:10);
  const last=monthly?new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).toISOString().slice(0,10):cursor;
  const scope={...filter,period:'custom' as const,dateMode:'range' as const,start:cursor,end:last>end?end:last};
  const totals=profitSummary(sales,expenses,movements,scope,module);
  trend.push({key,label:new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Kampala',...(monthly?{month:'short',year:'2-digit'}:{day:'numeric',month:'short'})} as Intl.DateTimeFormatOptions).format(new Date(cursor+'T12:00:00Z')),cash:totals.cashCollected,invoiced:totals.revenue,cogs:totals.cogs,expenses:totals.operatingExpenses,adjustments:totals.adjustments,net:totals.netProfit,cashNet:totals.cashCollected-totals.operatingExpenses});
  const next=new Date(cursor+'T12:00:00Z');if(monthly){next.setUTCDate(1);next.setUTCMonth(next.getUTCMonth()+1);}else next.setUTCDate(next.getUTCDate()+1);cursor=next.toISOString().slice(0,10);
 }
 const categoryMap=new Map<string,number>();
 for(const e of expenses.filter(e=>inPeriod(e.date,filter)&&(module==='all'||department(e.module)===module)))categoryMap.set(e.category,(categoryMap.get(e.category)||0)+e.amount);
 const categories=[...categoryMap].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
 const items=new Map<string,{name:string;value:number;quantity:number}>();
 for(const sale of sales.filter(s=>!s.voidedAt&&!s.internalComplementary&&inPeriod(s.date,filter))){
  const gross=sale.items.reduce((n,i)=>n+i.price*i.quantity,0);
  for(const item of sale.items.filter(i=>!i.complementaryFor&&(module==='all'||saleDepartment(i)===module))){
   const row=items.get(item.name)||{name:item.name,value:0,quantity:0};row.value+=gross?sale.total*item.price*item.quantity/gross:0;row.quantity+=item.quantity;items.set(item.name,row);
  }
 }
 const modules=['large-format','dtf','embroidery','bizhub','supplies','products','Unassigned'] as const;
 const names=['Large Format','DTF','Embroidery','Digital / Bizhub','Supplies','Other Products','Unassigned'];
 const departments=modules.map((id,i)=>{const t=profitSummary(sales,expenses,movements,filter,id);return {name:names[i],cash:t.cashCollected,costs:t.cogs+t.operatingExpenses+t.adjustments,expenses:t.operatingExpenses,net:t.netProfit};}).filter((_,i)=>module==='all'||modules[i]===module).filter(d=>d.cash||d.costs||d.expenses).sort((a,b)=>b.cash-a.cash);
 return {trend,categories,items:[...items.values()].sort((a,b)=>b.value-a.value),departments,totals:profitSummary(sales,expenses,movements,filter,module)};
}

