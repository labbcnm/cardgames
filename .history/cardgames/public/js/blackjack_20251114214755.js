console.log('Blackjack loaded');

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

function valueOf(card){
  if (card.value === 'A') return 11;
  if (['J','Q','K'].includes(card.value)) return 10;
  return Number(card.value);
}

function calcHandValue(hand){
  let total = 0, aces = 0;
  hand.forEach(c=>{ if(c.value==='A') aces++; else total+=valueOf(c); });
  for (let i=0;i<aces;i++){
    if (total + 11 <= 21) total += 11; else total += 1;
  }
  return total;
}

let deck, playerHands, dealerHand, activeHandIdx, betAmount;

function initElements(){
  document.getElementById('bet-btn').addEventListener('click', placeBet);
  document.getElementById('double-btn').addEventListener('click', onDouble);
  document.getElementById('split-btn').addEventListener('click', onSplit);
  document.getElementById('restart-btn').addEventListener('click', startGame);
}

function placeBet(){
  const input = document.getElementById('bet-input');
  const val = Math.max(1, Math.floor(Number(input.value) || 0));
  const coins = window.Casino.getCoins();
  if (val>coins){ alert('Not enough coins'); return; }
  betAmount = val;
  window.Casino.setCoins(coins - val);
  startRound();
}

function startGame(){
  document.getElementById('game-area').innerHTML = '<h2>Place a bet to start</h2>';
}

function startRound(){
  deck = new Deck();
  playerHands = [[deck.draw(), deck.draw()]];
  dealerHand = [deck.draw(), deck.draw()];
  activeHandIdx = 0;
  render();
}

function hit(){
  const hand = playerHands[activeHandIdx];
  hand.push(deck.draw());
  if (calcHandValue(hand)>21){
    if (activeHandIdx < playerHands.length -1) activeHandIdx++;
    else endRound();
  }
  render();
}

function stand(){
  if (activeHandIdx < playerHands.length -1) { activeHandIdx++; render(); return; }
  endRound();
}

function onDouble(){
  const coins = window.Casino.getCoins();
  if (betAmount > coins){ alert('Not enough coins to double'); return; }
  window.Casino.setCoins(coins - betAmount);
  playerHands[activeHandIdx].push(deck.draw());
  if (activeHandIdx < playerHands.length -1) activeHandIdx++;
  else endRound();
  render();
}

function onSplit(){
  const hand = playerHands[activeHandIdx];
  if (hand.length !==2 || hand[0].value !== hand[1].value){ alert('Cannot split'); return; }
  const coins = window.Casino.getCoins();
  if (betAmount > coins){ alert('Not enough coins to split'); return; }
  window.Casino.setCoins(coins - betAmount);
  const a = [hand[0], deck.draw()];
  const b = [hand[1], deck.draw()];
  playerHands.splice(activeHandIdx,1,a,b);
  render();
}

function endRound(){
  while (calcHandValue(dealerHand) < 17) dealerHand.push(deck.draw());
  let totalWin = 0;
  const dv = calcHandValue(dealerHand);
  playerHands.forEach(h=>{
    const pv = calcHandValue(h);
    if (pv > 21) totalWin -= betAmount;
    else if (dv > 21 || pv > dv) totalWin += betAmount*1;
    else if (pv < dv) totalWin -= betAmount*1;
    else totalWin += 0;
  });
  const coins = window.Casino.getCoins();
  window.Casino.setCoins(coins + totalWin + (totalWin>0?0:0));
  document.getElementById('result').innerText = (totalWin>0? `You win ${totalWin}` : totalWin<0? `You lose ${-totalWin}` : 'Push');
  render(true);
}

function render(finished=false){
  const area = document.getElementById('game-area');
  let html = '';
  html += `<h3>Dealer ${ finished ? '('+calcHandValue(dealerHand)+')' : '' }</h3>`;
  html += '<div>' + dealerHand.map(c=> finished? `<span class="card">${c.value}${c.suit}</span>`: `<span class="card">??</span>`).join(' ') + '</div>';

  playerHands.forEach((h, idx)=>{
    html += `<h3>Hand ${idx+1} ${ idx===activeHandIdx? '<span style="color:#00ff88">(Active)</span>':''} (${calcHandValue(h)})</h3>`;
    html += '<div>' + h.map(c=>`<span class="card">${c.value}${c.suit}</span>`).join(' ') + '</div>';
  });
  html += `<div class="result" id="result"></div>`;
  html += `<div class="player-controls">`;
  if (!finished) html += `<button onclick="hit()">Hit</button><button onclick="stand()">Stand</button>`;
  html += `</div>`;
  area.innerHTML = html;
}

window.hit = hit; window.stand = stand; window.startGame = startGame; window.onDouble = onDouble; window.onSplit = onSplit;
window.addEventListener('load', ()=>{ initElements(); startGame(); window.Casino && document.querySelectorAll('#coin-amount').forEach(el=> el.innerText = window.Casino.getCoins()); });
