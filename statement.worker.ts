import {statementHtml} from './statementExport';
self.onmessage=(event:MessageEvent)=>{
 try{self.postMessage({html:statementHtml(event.data)});}
 catch(error){self.postMessage({error:error instanceof Error?error.message:'Statement generation failed.'});}
};
