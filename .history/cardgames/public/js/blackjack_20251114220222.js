console.log('Blackjack loaded (multiplayer AI)');

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

function calcValue(hand){
  let total=0, aces=0;
  for (let c of hand){ if (c.value==='A') aces++; else if (['J','Q','K'].includes(c.value)) total+=10; else total+=Number(c.value); }
  for (let i=0;i<aces;i++) total += (total+11<=21)?11:1;
  return total;
}

function aiPlay(hand, deck){
  while (calcValue(hand) < 17){ hand.push(deck.draw()); }
}

let deckBJ, players, dealer;

function startBJGame(){
  const num = Math.max(1, Number(document.getElementById('bj-players').value || 1));
  deckBJ = new Deck();
  players = [];
  for (let i=0;i<num;i++){
    players.push({name: i===0? 'You' : 'AI '+i, hand:[deckBJ.draw(), deckBJ.draw()], bet:0, isAI: i!==0, busted:false});
  }
  dealer = {hand:[deckBJ.draw(), deckBJ.draw()] };
  renderBJ('Place bets and press Bet & Deal');
}

function placeAndDeal(){
  const userBet = Math.max(1, Math.floor(Number(document.getElementById('bet-input').value)||10));
  const coins = window.Casino.getCoins();
  if (userBet > coins){ alert('Not enough coins'); return; }
  window.Casino.setCoins(coins - userBet);
  players.forEach((p, idx)=>{ if (idx===0) p.bet = userBet; else p.bet = Math.max(1, Math.floor(userBet * (0.5 + Math.random()*0.8))); });
  renderBJ('Bet placed. Play your hand.');
}

function userHit(){
  const player = players[0];
  player.hand.push(deckBJ.draw());
  if (calcValue(player.hand) > 21){ player.busted = true; finishBJ(); }
  renderBJ();
}

function userStand(){ finishBJ(); }

function finishBJ(){
  for (let i=1;i<players.length;i++){ aiPlay(players[i].hand, deckBJ); if (calcValue(players[i].hand)>21) players[i].busted=true; }
  while (calcValue(dealer.hand) < 17) dealer.hand.push(deckBJ.draw());
  let net = 0;
  const dealerVal = calcValue(dealer.hand);
  players.forEach((p, idx)=>{
    const pv = calcValue(p.hand);
    if (idx===0){
      if (pv>21) net -= p.bet;
      else if (dealerVal>21 || pv>dealerVal) net += p.bet;
      else if (pv<dealerVal) net -= p.bet;
    }
  });
  const coins = window.Casino.getCoins();
  window.Casino.setCoins(coins + net);
  renderBJ('Round finished. ' + (net>0?`You won ${net}`: net<0?`You lost ${-net}`:'Push'));
}

function renderBJ(message){
  const area = document.getElementById('game-area');
  let html = `<h2 style="color:#00ff88">${message}</h2>`;
  html += `<h3>Dealer ${players && players.length? '('+ (dealer?calcValue(dealer.hand):'') +')':''}</h3>`;
  html += '<div>' + (dealer? dealer.hand.map(c=>`<span class="card">${c.value}${c.suit}</span>`).join(' '):'') + '</div>';
  players.forEach((p, idx)=>{
    html += `<h3>${p.name} ${idx===0?'<span style="color:#00ff88">(You)</span>':''} - Bet: ${p.bet}</h3>`;
    html += '<div>' + p.hand.map(c=>`<span class="card">${c.value}${c.suit}</span>`).join(' ') + ` <small>(${calcValue(p.hand)})</small></div>`;
  });
  html += `<div class="player-controls">`;
  if (players && players[0] && calcValue(players[0].hand) <= 21){ html += `<button onclick="userHit()">Hit</button><button onclick="userStand()">Stand</button>`; }
  html += `</div>`;
  html += `<div class="result" id="result"></div>`;
  area.innerHTML = html;
}

window.startBJGame = startBJGame; window.placeAndDeal = placeAndDeal; window.userHit = userHit; window.userStand = userStand;
window.addEventListener('load', ()=>{ startBJGame(); document.getElementById('bet-btn').addEventListener('click', placeAndDeal); document.getElementById('restart-btn').addEventListener('click', startBJGame); document.querySelectorAll('#open-exchange').forEach(b=> b.addEventListener('click', ()=> document.getElementById('exchange-modal').classList.remove('hidden'))); });
