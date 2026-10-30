import type {StatementInput} from './statementExport';
export function generateStatement(input:StatementInput):Promise<string>{
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./statement.worker.ts',import.meta.url),{type:'module'});
  const timer=setTimeout(()=>{worker.terminate();reject(new Error('Statement generation timed out. Please try monthly grouping or a shorter timeframe.'));},180000);
  const finish=()=>{clearTimeout(timer);worker.terminate();};
  worker.onmessage=event=>{finish();if(event.data.error)reject(new Error(event.data.error));else resolve(event.data.html);};
  worker.onerror=()=>{finish();reject(new Error('Unable to generate the statement. Please try again.'));};
  try{worker.postMessage(input);}catch(error){finish();reject(error);}
 });
}
