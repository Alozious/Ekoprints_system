import React,{createContext,useContext,useRef,useState} from 'react';
const PendingForm=createContext(false);
export function Spinner(){return <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" aria-hidden="true"/>;}
export default function ActionButton({onClick,disabled,children,loadingLabel='Working...',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{loadingLabel?:string}){
 const formPending=useContext(PendingForm),[pending,setPending]=useState(false),[error,setError]=useState('');
 const locked=useRef(false);
 const busy=pending||(formPending&&(props.type==='submit'||props.type===undefined));
 return <><button {...props} disabled={disabled||pending||formPending} aria-busy={busy||undefined} onClick={event=>{
  if(locked.current)return;
  setError('');
  try{
   const result=onClick?.(event) as unknown;
   if(result&&typeof (result as Promise<unknown>).then==='function'){
    locked.current=true;setPending(true);
    Promise.resolve(result).catch(e=>setError(e instanceof Error?e.message:'Unable to complete this action. Please try again.')).finally(()=>{locked.current=false;setPending(false);});
   }
  }catch(e){setError(e instanceof Error?e.message:'Unable to complete this action. Please try again.');}
 }}>{busy?<span className="inline-flex items-center justify-center gap-2" role="status"><Spinner/><span>{pending?loadingLabel:children}</span></span>:children}</button>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}</>;
}
export function ActionForm({onSubmit,children,...props}:React.FormHTMLAttributes<HTMLFormElement>){
 const [pending,setPending]=useState(false),[error,setError]=useState('');const locked=useRef(false);
 return <PendingForm.Provider value={pending}><form {...props} aria-busy={pending||undefined} onSubmit={event=>{
  if(locked.current){event.preventDefault();return;}
  setError('');
  try{
   const result=onSubmit?.(event) as unknown;
   if(result&&typeof (result as Promise<unknown>).then==='function'){
    event.preventDefault();locked.current=true;setPending(true);
    Promise.resolve(result).catch(e=>setError(e instanceof Error?e.message:'Unable to save. Please try again.')).finally(()=>{locked.current=false;setPending(false);});
   }
  }catch(e){event.preventDefault();setError(e instanceof Error?e.message:'Unable to save. Please try again.');}
 }}>{children}{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}</form></PendingForm.Provider>;
}
