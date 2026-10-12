import {useEffect,useRef,useState} from 'react';
export function useMobilePanel(){
 const [mobile,setMobile]=useState(()=>matchMedia('(max-width:760px), (max-width:1000px) and (pointer:coarse)').matches);
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLElement|null>(null);
 useEffect(()=>{const media=matchMedia('(max-width:760px), (max-width:1000px) and (pointer:coarse)');const update=()=>setMobile(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{
   if(!mobile||!open)return;
   const panel=ref.current;if(!panel)return;
   const opener=document.activeElement as HTMLElement|null;
   const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
   panel.querySelector<HTMLButtonElement>('.sheet-close')?.focus({preventScroll:true});
   const key=(event:KeyboardEvent)=>{
     if(event.key==='Escape'){event.preventDefault();setOpen(false);}
     if(event.key!=='Tab')return;
     const items=Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length);
     const first=items[0],last=items.at(-1);if(!first)return;
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   };
   document.addEventListener('keydown',key);
   return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',key);if(opener?.isConnected)opener.focus({preventScroll:true});};
 },[mobile,open]);
 return {mobile,open,setOpen,ref};
}
