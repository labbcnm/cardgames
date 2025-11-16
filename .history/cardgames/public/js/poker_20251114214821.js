console.log('Poker loaded');

function combinations(arr, k){
  const res = [];
  (function recur(start, comb){
    if (comb.length===k){ res.push(comb.slice()); return; }
    for (let i=start;i<arr.length;i++){ comb.push(arr[i]); recur(i+1, comb); comb.pop(); }
  })(0, []);
  return res;
}

function rankCounts(cards){
  const counts = {};
  cards.forEach(c=> counts[c.value] = (counts[c.value]||0)+1);
  return counts;
}

function isFlush(cards){
  const suits = {};
  cards.forEach(c=> suits[c.suit] = (suits[c.suit]||0)+1);
  for (let s in suits) if (suits[s] >=5) return true;
  return false;
}

function isStraight(values){
  const set = new Set(values);
  const arr = Array.from(set).sort((a,b)=>a-b);
  if (set.has(14)) arr.unshift(1);
  let consec = 1; let best = 1;
  for (let i=1;i<arr.length;i++){
    if (arr[i] === arr[i-1]+1) { consec++; best = Math.max(best, consec); } else consec = 1;
  }
  return best>=5;
}

function valueMap(v){
  if (v==='A') return 14; if (v==='K') return 13; if (v==='Q') return 12; if (v==='J') return 11; return Number(v);
}

function evaluate5(cards){
  const vals = cards.map(c=>valueMap(c.value)).sort((a,b)=>b-a);
  const counts = rankCounts(cards);
  const groups = Object.entries(counts).map(([v,c])=>({v: valueMap(v), c})).sort((a,b)=> b.c - a.c || b.v - a.v);
  const is_flush = isFlush(cards);
  const is_straight = isStraight(vals);
  let straightFlush = false;
  const suits = ['♠','♥','♦','♣'];
  for (let s of suits){
    const bySuit = cards.filter(c=>c.suit===s);
    if (bySuit.length>=5 && isStraight(bySuit.map(c=>valueMap(c.value)))) { straightFlush = true; break; }
  }
  if (straightFlush) return [9, vals];
  if (groups[0].c === 4) return [8, [groups[0].v, groups[1].v]];
  if (groups[0].c ===3 && groups[1] && groups[1].c>=2) return [7, [groups[0].v, groups[1].v]];
  if (is_flush) return [6, vals];
  if (is_straight) return [5, vals];
  if (groups[0].c ===3) return [4, [groups[0].v].concat(vals)];
  if (groups[0].c ===2 && groups[1] && groups[1].c===2) return [3, [groups[0].v, groups[1].v].concat(vals)];
  if (groups[0].c ===2) return [2, [groups[0].v].concat(vals)];
  return [1, vals];
}

function bestHandOfSeven(cards7){
  const combs = combinations(cards7,5);
  let best = null;
  for (let c of combs){
    const score = evaluate5(c);
    if (!best) best = {score, hand:c};
    else {
      const [aLevel, aTie] = score; const [bLevel, bTie] = best.score;
      if (aLevel > bLevel) best = {score, hand:c};
      else if (aLevel === bLevel){
        for (let i=0;i<Math.max(aTie.length,bTie.length);i++){
          const av = aTie[i]||0; const bv = bTie[i]||0;
          if (av > bv) { best = {score, hand:c}; break; }
          else if (av < bv) break;
        }
      }
    }
  }
  return best;
}

class Deck {
  constructor(){
    this.cards = [];
    const suits = ['♠','♥','♦','♣'];
    const vals = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    for (let s of suits) for (let v of vals) this.cards.push({suit:s,value:v});
    this.shuffle();
  }
  shuffle(){ this.cards.sort(()=>Math.random()-0.5); }
  draw(){ return this.cards.pop(); }
}

let deck, playerHand, dealerHand, community, pokerBet;

function startPoker(){
  deck = new Deck();
  playerHand = [deck.draw(), deck.draw()];
  dealerHand = [deck.draw(), deck.draw()];
  community = [];
  pokerBet = 0;
  renderPoker('Pre-Flop');
}

function placePokerBet(){
  const input = document.getElementById('poker-bet');
  const val = Math.max(1, Math.floor(Number(input.value)||0));
  const coins = window.Casino.getCoins();
  if (val>coins){ alert('Not enough coins'); return; }
  pokerBet = val; window.Casino.setCoins(coins - val);
  renderPoker('Bet placed: '+pokerBet);
}

function pokerNextStage(){
  if (community.length === 0) community.push(deck.draw(), deck.draw(), deck.draw());
  else if (community.length === 3) community.push(deck.draw());
  else if (community.length === 4) community.push(deck.draw());
  else alert('All community cards dealt');
  renderPoker('Stage');
}

function revealPoker(){
  const playerBest = bestHandOfSeven(playerHand.concat(community));
  const dealerBest = bestHandOfSeven(dealerHand.concat(community));
  const pa = playerBest.score; const da = dealerBest.score;
  let outcome = 0;
  if (pa[0] > da[0]) outcome = 1;
  else if (pa[0] < da[0]) outcome = -1;
  else {
    const at = pa[1]; const bt = da[1];
    for (let i=0;i<Math.max(at.length, bt.length);i++){
      const av = at[i]||0; const bv = bt[i]||0;
      if (av>bv){ outcome=1; break; }
      if (av<bv){ outcome=-1; break; }
    }
  }
  const coins = window.Casino.getCoins();
  if (outcome===1){ window.Casino.setCoins(coins + pokerBet*2); renderPoker('You win!'); }
  else if (outcome===-1){ renderPoker('You lose'); }
  else { window.Casino.setCoins(coins + pokerBet); renderPoker('Push (tie)'); }
}

function renderPoker(msg){
  const area = document.getElementById('game-area');
  const ch = (cards)=> cards.map(c=>`<span class="card">${c.value}${c.suit}</span>`).join(' ');
  area.innerHTML = `
    <h3 style="color:#00ff88">${msg}</h3>
    <div><strong>Your Hand</strong></div>
    <div>${ch(playerHand)}</div>
    <div><strong>Community</strong></div>
    <div>${ch(community)}</div>
    <div><strong>Dealer</strong></div>
    <div>${community.length===5? ch(dealerHand) : dealerHand.map(_=>'<span class="card">??</span>').join(' ')}</div>
    <div class="result" id="poker-result"></div>
  `;
}

window.startPoker = startPoker; window.placePokerBet = placePokerBet; window.pokerNextStage = pokerNextStage; window.revealPoker = revealPoker;
window.addEventListener('load', ()=>{ startPoker(); document.getElementById('poker-bet-btn').addEventListener('click', placePokerBet); document.getElementById('poker-next').addEventListener('click', pokerNextStage); document.getElementById('poker-reveal').addEventListener('click', revealPoker); document.getElementById('poker-restart').addEventListener('click', startPoker); window.Casino && document.querySelectorAll('#coin-amount').forEach(el=> el.innerText = window.Casino.getCoins()); });
