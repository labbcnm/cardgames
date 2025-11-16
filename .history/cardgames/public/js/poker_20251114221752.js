console.log('Poker loaded (multiplayer AI)');

class SimpleDeck {
  constructor(){ this.cards=[]; const suits=['♠','♥','♦','♣']; const vals=['2','3','4','5','6','7','8','9','10','J','Q','K','A']; for (let s of suits) for (let v of vals) this.cards.push({suit:s,value:v}); this.shuffle(); }
  shuffle(){ this.cards.sort(()=>Math.random()-0.5); }
  draw(){ return this.cards.pop(); }
}

function valueMap(v){ if (v==='A') return 14; if (v==='K') return 13; if (v==='Q') return 12; if (v==='J') return 11; return Number(v); }
function combinations(arr, k){ const res=[]; (function r(start,comb){ if (comb.length===k){ res.push(comb.slice()); return; } for (let i=start;i<arr.length;i++){ comb.push(arr[i]); r(i+1,comb); comb.pop(); } })(0,[]); return res; }
function rankCounts(cards){ const counts={}; cards.forEach(c=> counts[c.value]=(counts[c.value]||0)+1); return counts; }
function isFlush(cards){ const suits={}; cards.forEach(c=> suits[c.suit]=(suits[c.suit]||0)+1); for (let s in suits) if (suits[s]>=5) return true; return false; }
function isStraight(values){ const set=new Set(values); const arr=Array.from(set).sort((a,b)=>a-b); if (set.has(14)) arr.unshift(1); let consec=1,best=1; for (let i=1;i<arr.length;i++){ if (arr[i]===arr[i-1]+1){ consec++; best=Math.max(best,consec);} else consec=1; } return best>=5; }

function evaluate5(cards){ const vals=cards.map(c=>valueMap(c.value)).sort((a,b)=>b-a); const counts=rankCounts(cards); const groups=Object.entries(counts).map(([v,c])=>({v:valueMap(v), c})).sort((a,b)=> b.c - a.c || b.v - a.v); const is_flush=isFlush(cards); const is_straight=isStraight(vals);
  let straightFlush=false; const suits=['♠','♥','♦','♣']; for (let s of suits){ const bySuit=cards.filter(c=>c.suit===s); if (bySuit.length>=5 && isStraight(bySuit.map(c=>valueMap(c.value)))) { straightFlush=true; break; } }
  if (straightFlush) return [9, vals]; if (groups[0].c===4) return [8,[groups[0].v, groups[1].v]]; if (groups[0].c===3 && groups[1] && groups[1].c>=2) return [7,[groups[0].v, groups[1].v]]; if (is_flush) return [6, vals]; if (is_straight) return [5, vals]; if (groups[0].c===3) return [4,[groups[0].v].concat(vals)]; if (groups[0].c===2 && groups[1] && groups[1].c===2) return [3,[groups[0].v, groups[1].v].concat(vals)]; if (groups[0].c===2) return [2,[groups[0].v].concat(vals)]; return [1, vals]; }

function bestHandOfSeven(cards7){ const combs=combinations(cards7,5); let best=null; for (let c of combs){ const score=evaluate5(c); if (!best) best={score,hand:c}; else{ const [aLevel,aTie]=score; const [bLevel,bTie]=best.score; if (aLevel>bLevel) best={score,hand:c}; else if (aLevel===bLevel){ for (let i=0;i<Math.max(aTie.length,bTie.length);i++){ const av=aTie[i]||0; const bv=bTie[i]||0; if (av>bv){ best={score,hand:c}; break;} else if (av<bv) break; } } } } return best; }

let deckP, playersP, communityP, potP, currentBetP, currentStageP;

function startPokerGame(){
  const num = Math.max(1, Number(document.getElementById('poker-players').value || 1));
  deckP = new SimpleDeck(); playersP = [];
  for (let i=0;i<num;i++) playersP.push({name: i===0? 'You' : 'AI '+i, hand:[deckP.draw(), deckP.draw()], bet:0, isAI: i!==0, folded:false});
  communityP = []; potP = 0; currentBetP = 0; currentStageP = 'pre-flop';
  renderPoker('Pre-Flop: Place bets');
}

function placePokerBet(){
  const val = Math.max(1, Math.floor(Number(document.getElementById('poker-bet').value)||10));
  const coins = window.Casino.getCoins(); if (val>coins){ alert('Not enough coins'); return; }
  window.Casino.setCoins(coins - val);
  playersP.forEach((p,idx)=>{ p.bet = idx===0? val : Math.max(1, Math.floor(val*(0.5+Math.random()*0.9))); potP += p.bet; });
  currentBetP = val; renderPoker('Bets placed.');
}

function pokerNext(){
  if (communityP.length===0) communityP.push(deckP.draw(), deckP.draw(), deckP.draw());
  else if (communityP.length===3) communityP.push(deckP.draw());
  else if (communityP.length===4) communityP.push(deckP.draw());
  else alert('All community cards dealt');
  playersP.forEach((p,idx)=>{ if (p.isAI && Math.random()<0.05) p.folded=true; });
  renderPoker('Stage progressed');
}

function pokerReveal(){
  const live = playersP.filter(p=>!p.folded);
  const scores = live.map(p=>({player:p, best: bestHandOfSeven(p.hand.concat(communityP))}));
  let winner = scores[0];
  for (let i=1;i<scores.length;i++){
    const a = scores[i].best.score; const b = winner.best.score;
    if (a[0] > b[0]) winner = scores[i];
    else if (a[0] === b[0]){
      const at = a[1]; const bt = b[1];
      for (let k=0;k<Math.max(at.length, bt.length);k++){ const av=at[k]||0; const bv=bt[k]||0; if (av>bv){ winner = scores[i]; break; } else if (av < bv) break; }
    }
  }
  if (winner && winner.player.name === 'You'){
    window.Casino.setCoins(window.Casino.getCoins() + potP*2);
    renderPoker('You Win the pot: '+potP);
  } else {
    renderPoker('Winner: '+ (winner? winner.player.name : 'No one') + '. You lost.');
  }
}

function renderPoker(msg){
  const area = document.getElementById('game-area');
  if (!area) return;
  const ch = (cards)=> cards.map(c=>`<span class="card">${c.value}${c.suit}</span>`).join(' ');
  let html = `<h2 style="color:#00ff88">${msg}</h2>`;
  html += `<div><strong>Pot:</strong> ${potP}</div>`;
  html += '<div><strong>Community</strong></div>' + `<div>${ch(communityP)}</div>`;
  playersP.forEach(p=>{
    html += `<h3>${p.name} ${p.isAI? '(AI)':''} ${p.folded? '(Folded)':''}</h3>`;
    html += `<div>${p.folded? '---': ch(p.hand)} ${p.isAI? '' : '<small>(You)</small>'}</div>`;
  });
  area.innerHTML = html;
}

window.startPokerGame = startPokerGame; window.placePokerBet = placePokerBet; window.pokerNext = pokerNext; window.pokerReveal = pokerReveal;
window.addEventListener('load', ()=>{ startPokerGame(); document.getElementById('poker-bet-btn').addEventListener('click', placePokerBet); document.getElementById('poker-next').addEventListener('click', pokerNext); document.getElementById('poker-reveal').addEventListener('click', pokerReveal); document.getElementById('poker-restart').addEventListener('click', startPokerGame); document.querySelectorAll('#open-exchange').forEach(b=> b.addEventListener('click', ()=> document.getElementById('exchange-modal').classList.remove('hidden'))); });

