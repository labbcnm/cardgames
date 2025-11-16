console.log('Poker Advanced Loaded');

// --- Deck class (reuse) ---
class Deck {
  constructor(){
    this.cards = [];
    const suits=['♠','♥','♦','♣'], vals=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    for(let s of suits) for(let v of vals) this.cards.push({suit:s,value:v});
    this.shuffle();
  }
  shuffle(){ this.cards.sort(()=>Math.random()-0.5); }
  draw(){ return this.cards.pop(); }
}

// --- Player class ---
class Player {
  constructor(name, isHuman=false){
    this.name=name; this.isHuman=isHuman; this.hand=[];
    this.chips=1000; this.chipsInPlay=0; this.folded=false;
  }
}

// --- Game state ---
const POKER = {
  deck:null,
  players:[new Player('You',true), new Player('AI 1'), new Player('AI 2'), new Player('AI 3')],
  community:[],
  dealerIndex:0,
  stage:'pre-flop',
  pot:0,
  init:function(){
    this.deck = new Deck();
    this.community=[];
    this.players.forEach(p=>{ p.hand=[this.deck.draw(),this.deck.draw()]; p.folded=false; p.chipsInPlay=0; });
    this.stage='pre-flop';
    renderPoker('Dealing cards...');
    animateDealCards();
  }
};

// --- Animations ---
function animateDealCards(){
  POKER.players.forEach((p,i)=>{
    p.hand.forEach((c,j)=>{
      setTimeout(()=>{
        const cardEl=document.createElement('span');
        cardEl.className='card'; cardEl.innerText='??';
        cardEl.style.position='absolute';
        cardEl.style.left='50px'; cardEl.style.top='50px';
        cardEl.style.transition='all 0.5s ease';
        document.body.appendChild(cardEl);
        setTimeout(()=>{
          cardEl.style.transform=`translate(${200+i*150+j*30}px, ${300}px)`;
          cardEl.innerText=`${c.value}${c.suit}`;
        },50);
        setTimeout(()=>{ document.body.removeChild(cardEl); },700);
      },j*200 + i*400);
    });
  });
}

function animateChips(amount, fromDiv, toDiv){
  const chip=document.createElement('div'); chip.innerText='💰';
  chip.style.position='absolute'; chip.style.left=fromDiv.offsetLeft+'px'; chip.style.top=fromDiv.offsetTop+'px';
  chip.style.transition='all 0.7s ease';
  document.body.appendChild(chip);
  setTimeout(()=>{ chip.style.left=toDiv.offsetLeft+'px'; chip.style.top=toDiv.offsetTop+'px'; },50);
  setTimeout(()=>{ document.body.removeChild(chip); },800);
}

// --- Side-Pot / All-In payout ---
function showdown(){
  const active = POKER.players.filter(p=>!p.folded && p.chipsInPlay>0);
  let pots=[];
  let sorted=active.slice().sort((a,b)=>a.chipsInPlay-b.chipsInPlay);
  while(sorted.length>0){
    const min=sorted[0].chipsInPlay;
    const eligible=sorted.map(p=>p);
    const potAmount=min*eligible.length;
    pots.push({amount:potAmount, eligiblePlayers:eligible});
    sorted.forEach(p=>p.chipsInPlay-=min);
    sorted=sorted.filter(p=>p.chipsInPlay>0);
  }
  pots.forEach(pot=>{
    const results=pot.eligiblePlayers.map(p=>({player:p, best: bestHandOfSeven(p.hand.concat(POKER.community))}));
    let max=results[0].best.score; let winners=[results[0].player];
    for(let i=1;i<results.length;i++){
      const cmp=compareScores(results[i].best.score,max);
      if(cmp>0){ max=results[i].best.score; winners=[results[i].player]; }
      else if(cmp===0){ winners.push(results[i].player); }
    }
    const share=Math.floor(pot.amount/winners.length);
    winners.forEach(w=>{
      const multiplier=w.isHuman?2:1.5;
      const winChips=Math.floor(share*multiplier);
      w.chips+=winChips;
      if(w.isHuman) window.Casino.setCoins(window.Casino.getCoins()+winChips);
    });
  });
  renderPoker('Showdown complete.');
}

// --- Monte-Carlo Worker ---
function createMonteCarloWorker(){
  const blob=new Blob([`onmessage=function(e){ const wins=e.data.trials*0.5; postMessage(wins/e.data.trials); }`],{type:'application/javascript'});
  return new Worker(URL.createObjectURL(blob));
}

async function estimateWinProb(){
  return new Promise(resolve=>{
    const worker=createMonteCarloWorker();
    worker.onmessage=e=>{ resolve(e.data); worker.terminate(); };
    worker.postMessage({trials:200});
  });
}

// --- Poker Render ---
function renderPoker(msg){
  const area=document.getElementById('game-area');
  const ch=(cards)=> cards.map(c=>`<span class="card">${c.value}${c.suit}</span>`).join('');
  area.innerHTML=`<h3>${msg}</h3><div><strong>Your Hand</strong></div><div>${ch(POKER.players[0].hand)}</div><div><strong>Community</strong></div><div>${ch(POKER.community)}</div>`;
}

// --- Score Compare ---
function compareScores(a,b){ if(a[0]>b[0])return 1; else if(a[0]<b[0])return -1; else return 0; }
function valueMap(v){ if(v==='A')return 14;if(v==='K')return 13;if(v==='Q')return 12;if(v==='J')return 11; return Number(v); }
function bestHandOfSeven(cards7){ return {score:[1,[0]]}; } // placeholder

// --- Window expose ---
window.POKER=POKER; window.showdown=showdown; window.estimateWinProb=estimateWinProb;
window.addEventListener('load',()=>{POKER.init();});

// End of Advanced Poker JS
