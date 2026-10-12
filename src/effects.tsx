import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {View,Color} from '../shared/types';
import {LABELS,SYMBOLS} from '../shared/types';
import {audio,type Sound} from './sound';
export type GameEffect={id:number;kind:Sound;color?:Color;rank?:number;label:string};
export function useGameEffects(view:View|undefined,connected:boolean){
 const previous=useRef<View|undefined>(undefined);const lastSnapshot=useRef<View|undefined>(undefined);const awaitingFresh=useRef(false);const serial=useRef(0);const [effect,setEffect]=useState<GameEffect>();
 useEffect(()=>{
   if(!connected){previous.current=undefined;awaitingFresh.current=true;setEffect(undefined);return;}
   if(awaitingFresh.current){if(view===lastSnapshot.current)return;awaitingFresh.current=false;previous.current=view;lastSnapshot.current=view;return;}
   const old=previous.current;previous.current=view;lastSnapshot.current=view;
   // Initial/recovered snapshots never replay old turns or reveal extra information.
   if(!old||!view||old.code!==view.code)return;
   let event:Omit<GameEffect,'id'>|undefined;
   const g=view.game, before=old.game;
   if(old.phase==='lobby'&&view.phase==='playing')event={kind:'start',label:'불꽃놀이 시작'};
   else if(g&&before&&g.turn>before.turn){
     const log=g.logs.filter(l=>l.turn===g.turn&&l.kind!=='system').at(-1);
     if(log?.kind==='hint')event={kind:'hint',label:'힌트 전달'};
     else if(log?.kind==='discard')event={kind:'discard',label:'힌트 +1',...log.card};
     else if(log?.kind==='play')event={kind:g.strikes>before.strikes?'fail':log.card?.rank===5?'complete':'play',label:g.strikes>before.strikes?'앗, 순서가 달라요':log.card?.rank===5?(g.tokens>before.tokens?'불꽃 완성 · 힌트 +1':'불꽃 완성'):'제출 성공 · +1점',...log.card};
     if(view.phase==='ended')event={...event,kind:g.reason==='perfect'?'win':g.reason==='strikes'?'fail':'end',label:g.reason==='perfect'?'완벽한 불꽃놀이!':g.reason==='strikes'?'불꽃놀이 종료':'마지막 불꽃까지 함께'};
   }
   if(event){audio.play(event.kind);setEffect({...event,id:++serial.current});}
   else if(view.phase==='lobby')setEffect(undefined);
 },[view,connected]);
 useEffect(()=>{if(!effect)return;const timer=setTimeout(()=>setEffect(undefined),effect.kind==='win'?2400:1600);return()=>clearTimeout(timer);},[effect]);
 return effect;
}
export function EffectLayer({effect}:{effect?:GameEffect}){
 if(!effect)return null;
 const burst=['play','complete','win'].includes(effect.kind);
 return <div key={effect.id} className={`game-effect effect-${effect.kind} ${effect.color||''}`} data-testid="game-effect" aria-hidden="true">
   {burst&&<div className="spark-burst">{Array.from({length:effect.kind==='win'?24:14},(_,i)=>{const a=i*Math.PI*2/(effect.kind==='win'?24:14);const r=i%2?100:72;return <i key={i} style={{'--sx':`${Math.cos(a)*r}px`,'--sy':`${Math.sin(a)*r}px`,'--delay':`${i%3*30}ms`} as CSSProperties}/>;})}</div>}
   {effect.color&&effect.rank&&<div className="effect-card"><span>{SYMBOLS[effect.color]}</span><b>{effect.rank}</b><small>{LABELS[effect.color]}</small></div>}
   <div className="effect-label">{effect.kind==='hint'?'✧':effect.kind==='fail'?'✕':effect.kind==='discard'?'↗':'✺'} {effect.label}</div>
 </div>;
}
