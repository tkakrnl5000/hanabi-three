import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomBytes,randomInt} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,renameSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {COLORS,type Game,type View,type Reply} from '../shared/types.js';
import {applyAction,startGame,visibleHands,score,builtScore} from './game.js';
type Player={name:string;token:string;ready:boolean;socketId?:string};
type Room={code:string;players:Player[];game?:Game;revision:number;updated:number;first?:number};
const cardAction=z.object({type:z.enum(['play','discard']),cardId:z.string().uuid()}).strict();
const actionSchema=z.union([cardAction,z.object({type:z.literal('hint'),target:z.number().int().min(0).max(2),kind:z.literal('color'),value:z.enum(COLORS)}).strict(),z.object({type:z.literal('hint'),target:z.number().int().min(0).max(2),kind:z.literal('rank'),value:z.number().int().min(1).max(5)}).strict()]);
const joinSchema=z.object({code:z.string().regex(/^[A-Z2-9]{6}$/).optional(),name:z.string().trim().min(1).max(16).regex(/^[\p{L}\p{N} _-]+$/u),token:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict();
export function createApp(options:{dataDir?:string;staticDir?:string}={}){
  const app=express(); app.disable('x-powered-by');
  app.use((_req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; frame-ancestors 'none'");next();});
  const http=createServer(app);
  const io=new Server(http,{maxHttpBufferSize:4096,serveClient:false,allowRequest:(req,done)=>{const origin=req.headers.origin;let allowed=!origin;try{if(origin)allowed=new URL(origin).host===req.headers.host;}catch{allowed=false;}done(null,allowed);}});
  const rooms=new Map<string,Room>(); const file=options.dataDir?path.join(options.dataDir,'rooms.json'):undefined;
  if(file){mkdirSync(options.dataDir!,{recursive:true});try{const saved=JSON.parse(readFileSync(file,'utf8')) as Room[];for(const room of saved){room.players.forEach(p=>delete p.socketId);rooms.set(room.code,room);}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
  function persist(){if(file){const tmp=file+'.tmp';writeFileSync(tmp,JSON.stringify([...rooms.values()]),{mode:0o600});renameSync(tmp,file);}}
  function view(room:Room,seat:number):View{const g=room.game;return {code:room.code,seat,first:room.first,revision:room.revision,phase:g?g.status==='playing'?'playing':'ended':'lobby',players:room.players.map(p=>({name:p.name,connected:!!p.socketId,ready:p.ready})),...(g?{game:{hands:visibleHands(g,seat),stacks:{...g.stacks},discards:g.discards.map(c=>({color:c.color,rank:c.rank})),tokens:g.tokens,strikes:g.strikes,turn:g.turn,current:g.current,finalTurns:g.finalTurns,deckCount:g.deck.length,score:score(g),builtScore:builtScore(g),reason:g.reason,logs:g.logs}}:{})};}
  function publish(room:Room){room.updated=Date.now();persist();room.players.forEach((p,i)=>{if(p.socketId)io.to(p.socketId).emit('state',view(room,i));});}
  const cleanup=setInterval(()=>{for(const [code,room] of rooms)if(Date.now()-room.updated>86400000&&!room.players.some(p=>p.socketId))rooms.delete(code);persist();},60000);cleanup.unref();
  io.on('connection',socket=>{
    let identity:{code:string;seat:number}|undefined;
    let count=0;let window=Date.now();
    const safe=(handler:(data:unknown)=>Reply)=>(data:unknown,ack?: (r:Reply)=>void)=>{
      if(typeof ack!=='function')return;
      try {if(Date.now()-window>10000){window=Date.now();count=0;} if(++count>40)throw new Error('요청이 너무 빠릅니다. 잠시 후 다시 시도하세요.');ack(handler(data));}
      catch(error){ack({ok:false,error:error instanceof Error?error.message:'요청을 처리하지 못했습니다.'});}
    };
    const mine=()=>{if(!identity)throw new Error('먼저 방에 입장하세요.');const room=rooms.get(identity.code);if(!room||room.players[identity.seat]?.socketId!==socket.id)throw new Error('다른 연결에서 자리가 복구되었습니다.');return {room,seat:identity.seat};};
    socket.on('join',safe(data=>{
      if(identity)throw new Error('이미 방에 입장했습니다.');const input=joinSchema.parse(data);
      let room:Room;let seat:number;
      if(input.code){const found=rooms.get(input.code);if(!found)throw new Error('존재하지 않거나 만료된 방입니다.');room=found;
        seat=input.token?room.players.findIndex(p=>p.token===input.token):-1;
        if(seat<0){if(input.token)throw new Error('자리 복구 키가 올바르지 않습니다.');if(room.game||room.players.length>=3)throw new Error('이 방은 입장할 수 없습니다.');seat=room.players.length;room.players.push({name:input.name,token:randomBytes(32).toString('hex'),ready:false});}
      }else{if(rooms.size>=1000)throw new Error('방이 가득 찼습니다.');const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code:string;do{code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(rooms.has(code));room={code,players:[{name:input.name,token:randomBytes(32).toString('hex'),ready:false}],revision:0,updated:Date.now()};rooms.set(code,room);seat=0;}
      const p=room.players[seat];const previous=p.socketId;p.socketId=socket.id;identity={code:room.code,seat};
      if(previous&&previous!==socket.id){io.sockets.sockets.get(previous)?.emit('replaced');io.sockets.sockets.get(previous)?.disconnect(true);}
      if(!room.game&&room.first!==undefined&&room.players.length===3&&room.players.every(p=>p.ready&&p.socketId)){room.game=startGame(room.first);room.revision++;}publish(room);return {ok:true,token:p.token,code:room.code,seat};
    }));
    socket.on('first',safe(data=>{const first=z.number().int().min(0).max(2).parse(data);const {room,seat}=mine();if(seat!==0||room.game||!room.players[first])throw new Error('방장이 로비에서 첫 플레이어를 선택할 수 있습니다.');room.first=first;room.players.forEach(p=>p.ready=false);room.revision++;publish(room);return {ok:true};}));
    socket.on('ready',safe(data=>{const ready=z.boolean().parse(data);const {room,seat}=mine();if(room.game)throw new Error('로비에서만 준비할 수 있습니다.');if(room.first===undefined)throw new Error('방장이 첫 플레이어를 먼저 지정하세요.');room.players[seat].ready=ready;
      if(room.players.length===3&&room.players.every(p=>p.ready&&p.socketId))room.game=startGame(room.first);room.revision++;publish(room);return {ok:true};}));
    socket.on('action',safe(data=>{const input=z.object({revision:z.number().int().nonnegative(),action:actionSchema}).strict().parse(data);const {room,seat}=mine();if(!room.game)throw new Error('게임이 시작되지 않았습니다.');if(input.revision!==room.revision)throw new Error('이미 처리된 턴입니다. 최신 상태에서 다시 선택하세요.');applyAction(room.game,seat,input.action);room.revision++;publish(room);return {ok:true};}));
    socket.on('rematch',safe(data=>{z.null().parse(data);const {room}=mine();if(room.game?.status!=='ended')throw new Error('결과 화면에서 재대결할 수 있습니다.');delete room.game;room.players.forEach(p=>p.ready=false);room.revision++;publish(room);return {ok:true};}));
    socket.on('disconnect',()=>{if(identity){const room=rooms.get(identity.code);const p=room?.players[identity.seat];if(room&&p?.socketId===socket.id){delete p.socketId;publish(room);}}});
  });
  app.get('/healthz',(_req,res)=>res.json({ok:true}));
  if(options.staticDir){app.use(express.static(options.staticDir));app.get('/{*path}',(_req,res)=>res.sendFile(path.join(options.staticDir!,'index.html')));}
  return {app,http,io,close:async()=>{clearInterval(cleanup);await new Promise<void>(resolve=>io.close(()=>resolve()));}};
}
