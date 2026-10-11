import { randomInt, randomUUID } from 'node:crypto';
import {COLORS,LABELS,type Card,type Game,type Action,type VisibleCard} from '../shared/types.js';
export class RuleError extends Error {}
const need = (condition:unknown,message:string) => {if(!condition) throw new RuleError(message);};
export function createDeck():Card[] {
  return COLORS.flatMap(color=>[1,1,1,2,2,3,3,4,4,5].map(rank=>({id:randomUUID(),color,rank,knowledge:{colors:[...COLORS],ranks:[1,2,3,4,5],history:[]}})));
}
export function startGame(first=randomInt(3)):Game {
  const deck=createDeck(); for(let i=deck.length-1;i>0;i--){const j=randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
  const hands:Card[][]=[[],[],[]]; for(let i=0;i<5;i++) for(const hand of hands) hand.push(deck.pop()!);
  return {hands,deck,stacks:{red:0,yellow:0,green:0,blue:0,white:0},discards:[],tokens:8,strikes:0,turn:0,current:first,finalTurns:null,status:'playing',logs:[{turn:0,text:'세 사람의 불꽃놀이가 시작되었습니다.',kind:'system'}]};
}
export const builtScore=(game:Game)=>Object.values(game.stacks).reduce((a,b)=>a+b,0);
export const score=(game:Game)=>game.reason==='strikes'?0:builtScore(game);
export function applyAction(game:Game,seat:number,action:Action):void {
  need(game.status==='playing','이미 끝난 게임입니다.'); need(seat===game.current,'내 차례가 아닙니다.');
  const wasFinal=game.finalTurns!==null;
  const turn=game.turn+1;
  if(action.type==='hint') {
    need(game.tokens>0,'힌트 토큰이 없습니다.');
    need(Number.isInteger(action.target)&&action.target>=0&&action.target<3&&action.target!==seat,'다른 플레이어를 선택하세요.');
    need(action.kind==='color'?COLORS.includes(action.value):Number.isInteger(action.value)&&action.value>=1&&action.value<=5,'올바르지 않은 힌트입니다.');
    const hand=game.hands[action.target];
    const matches=hand.map(card=>action.kind==='color'?card.color===action.value:card.rank===action.value);
    need(matches.some(Boolean),'일치하는 카드가 없는 힌트입니다.');
    hand.forEach((card,i)=>{
      const k=card.knowledge;
      if(action.kind==='color') k.colors=k.colors.filter(c=>matches[i]?c===action.value:c!==action.value);
      else k.ranks=k.ranks.filter(n=>matches[i]?n===action.value:n!==action.value);
      k.history.push({turn,from:seat,kind:action.kind,value:action.value,matched:matches[i]});
    });
    game.tokens--;
    game.logs.push({turn,kind:'hint',text:`${seat+1}번 → ${action.target+1}번: ${action.kind==='color'?LABELS[action.value]:action.value+'번'} · ${matches.map((m,i)=>m?i+1:null).filter(Boolean).join(', ')}번째 카드`});
  } else {
    need(action.type==='play'||action.type==='discard','올바르지 않은 행동입니다.');
    const hand=game.hands[seat]; const index=hand.findIndex(c=>c.id===action.cardId);
    need(index>=0,'선택한 카드가 현재 손에 없습니다.');
    if(action.type==='discard') need(game.tokens<8,'힌트 토큰이 8개일 때는 버릴 수 없습니다.');
    const [card]=hand.splice(index,1); let text:string;
    if(action.type==='discard'){game.discards.push(card);game.tokens++;text='버림';}
    else if(game.stacks[card.color]+1===card.rank){game.stacks[card.color]++;if(card.rank===5)game.tokens=Math.min(8,game.tokens+1);text='제출 성공';}
    else {game.discards.push(card);game.strikes++;text='제출 실패';}
    game.logs.push({turn,kind:action.type,card:{color:card.color,rank:card.rank},text:`${seat+1}번: ${LABELS[card.color]} ${card.rank} · ${text}`});
    // Immediate endings precede drawing a replacement.
    if(game.strikes>=3){game.status='ended';game.reason='strikes';}
    else if(builtScore(game)===25){game.status='ended';game.reason='perfect';}
    else if(game.deck.length){hand.push(game.deck.pop()!);if(!game.deck.length)game.finalTurns=3;}
  }
  game.turn=turn;
  if(game.status==='playing'&&wasFinal){game.finalTurns!--;if(game.finalTurns===0){game.status='ended';game.reason='deck';}}
  game.current=(seat+1)%3;
  if(game.status==='ended')game.logs.push({turn,kind:'system',text:`불꽃놀이 종료 · ${score(game)}점`});
}
export function visibleHands(game:Game,seat:number):VisibleCard[][] {
  // Whitelist every field; do not serialize and then try to hide secrets.
  return game.hands.map((hand,i)=>hand.map(c=>({id:c.id,knowledge:structuredClone(c.knowledge),...(i!==seat?{color:c.color,rank:c.rank}:{})})));
}
