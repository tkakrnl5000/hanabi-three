import {useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
export function useDialog(open:boolean,ref:RefObject<HTMLElement|null>,setOpen:(open:boolean)=>void){
 useEffect(()=>{
   if(!open)return;
   const panel=ref.current;if(!panel)return;
   const opener=document.activeElement as HTMLElement|null;
   const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
   const controls=()=>Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')).filter(el=>el.getClientRects().length);
   controls()[0]?.focus({preventScroll:true});
   const key=(event:KeyboardEvent)=>{
     if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);return;}
     if(event.key!=='Tab')return;
     const items=controls(),first=items[0],last=items.at(-1);if(!first)return;
     if(!panel.contains(document.activeElement)){event.preventDefault();first.focus();}
     else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   };
   document.addEventListener('keydown',key);
   return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',key);if(opener?.isConnected)opener.focus({preventScroll:true});};
 },[open,ref,setOpen]);
}
export function useMobilePanel(){
 const [mobile,setMobile]=useState(()=>matchMedia('(max-width:760px), (max-width:1000px) and (pointer:coarse)').matches);
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLElement|null>(null);
 useEffect(()=>{const media=matchMedia('(max-width:760px), (max-width:1000px) and (pointer:coarse)');const update=()=>setMobile(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useDialog(mobile&&open,ref,setOpen);
 return {mobile,open,setOpen,ref};
}
export function useDockHeight(active:boolean,main:RefObject<HTMLElement|null>,dock:RefObject<HTMLElement|null>){
 useLayoutEffect(()=>{
   const container=main.current,hand=dock.current;if(!active||!container||!hand)return;
   // Observe the actual card dock, including safe-area insets and larger text settings.
   const update=()=>container.style.setProperty('--dock-height',`${Math.ceil(hand.getBoundingClientRect().height)}px`);
   update();const observer=new ResizeObserver(update);observer.observe(hand);
   return()=>{observer.disconnect();container.style.removeProperty('--dock-height');};
 },[active,main,dock]);
}
