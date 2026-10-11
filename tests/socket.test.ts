import {it,expect} from 'vitest';
import {io,type Socket} from 'socket.io-client';
import {createApp} from '../server/app';
import type {View,Reply} from '../shared/types';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
const emit=(s:Socket,event:string,data:unknown)=>new Promise<Reply>(r=>s.emit(event,data,r));
const delay=()=>new Promise(r=>setTimeout(r,60));
it('3개 연결: 자리 인증, 누출 방지, 중복·위조 거부, 재접속, 서버 복구, 재대결',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'hanabi-'));let server=createApp({dataDir:dir});await new Promise<void>(r=>server.http.listen(0,'127.0.0.1',r));const port=(server.http.address() as {port:number}).port;const url=`http://127.0.0.1:${port}`;let clients:Socket[]=[];const states:View[]=[];const join=async(i:number,code?:string,token?:string)=>{const s=io(url,{transports:['websocket'],reconnection:false});clients[i]=s;s.on('state',v=>states[i]=v);await new Promise<void>(r=>s.on('connect',r));return emit(s,'join',{name:'플레이어'+i,...(code?{code}:{}),...(token?{token}:{})});};
 try{
 const a=await join(0);const b=await join(1,a.code);await join(2,a.code);expect(a.ok&&b.ok).toBe(true);await emit(clients[0],'first',0);for(const c of clients)await emit(c,'ready',true);await delay();
 expect(states.map(v=>v.phase)).toEqual(['playing','playing','playing']);for(let i=0;i<3;i++){expect(states[i]).not.toHaveProperty('deck');expect(states[i].game).not.toHaveProperty('deck');expect(states[i].players[0]).not.toHaveProperty('token');expect(states[i].game!.hands[i].every(c=>!('rank'in c)&&!('color'in c))).toBe(true);}
 const g=states[0].game!;const revision=states[0].revision;const data={revision,action:{type:'hint',target:1,kind:'rank',value:g.hands[1][0].rank}};
 expect((await emit(clients[0],'action',{...data,action:{...data.action,matches:[0]}})).ok).toBe(false);
 const duplicate=await Promise.all([emit(clients[0],'action',data),emit(clients[0],'action',data)]);expect(duplicate.filter(r=>r.ok)).toHaveLength(1);await delay();expect(states.map(v=>v.game!.turn)).toEqual([1,1,1]);
 clients[1].disconnect();await delay();expect(states[0].players[1].connected).toBe(false);expect((await join(1,a.code,b.token)).ok).toBe(true);await delay();expect(states[1].seat).toBe(1);expect(states[1].game!.turn).toBe(1);
 const attacker=io(url,{transports:['websocket']});await new Promise<void>(r=>attacker.on('connect',r));expect((await emit(attacker,'join',{name:'위조',code:a.code,token:'a'.repeat(64)})).ok).toBe(false);attacker.disconnect();
 clients.forEach(c=>c.disconnect());await delay();await server.close();server=createApp({dataDir:dir});await new Promise<void>(r=>server.http.listen(port,'127.0.0.1',r));await join(0,a.code,a.token);await join(1,a.code,b.token);await delay();expect(states[0].game!.turn).toBe(1);
 // Use legitimate public information from the other observer to deliberately misplay.
 while(states[0].phase==='playing'){const current=states[0].game!.current;if(current===2){ // recover third seat from server snapshot only in integration fixture
 const snapshot=JSON.parse((await import('node:fs')).readFileSync(path.join(dir,'rooms.json'),'utf8'));await join(2,a.code,snapshot[0].players[2].token);
 }await delay();const observer=states[(current+1)%3]||states[0];const hand=observer.game!.hands[current];const bad=hand.find(c=>c.rank!==observer.game!.stacks[c.color!]+1);const v=states[current];const action=bad?{type:'play',cardId:bad.id}:{type:'hint',target:(current+1)%3,kind:'rank',value:states[(current+2)%3].game!.hands[(current+1)%3][0].rank};expect((await emit(clients[current],'action',{revision:v.revision,action})).ok).toBe(true);await delay();}
 expect(states[0].game!.reason).toBe('strikes');expect((await emit(clients[0],'rematch',null)).ok).toBe(true);await delay();expect(states.map(v=>v.phase)).toEqual(['lobby','lobby','lobby']);for(const c of clients)await emit(c,'ready',true);await delay();expect(states[0].game!.turn).toBe(0);expect(states[0].game!.deckCount).toBe(35);
 }finally{clients.forEach(c=>c.disconnect());await server.close();rmSync(dir,{recursive:true,force:true});}
});
