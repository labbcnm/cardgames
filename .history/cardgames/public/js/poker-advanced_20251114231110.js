console.log('Poker Advanced Loaded');

// --- Deck class (reuse) ---
class Deck {
    constructor() {
        this.cards = [];
        const suits = ['♠', '♥', '♦', '♣'], vals = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        for (let s of suits) for (let v of vals) this.cards.push({ suit: s, value: v });
        this.shuffle();
    }
    shuffle() { this.cards.sort(() => Math.random() - 0.5); }
    draw() { return this.cards.pop(); }
}

// --- Player class ---
class Player {
    constructor(name, isHuman = false) {
        this.name = name; this.isHuman = isHuman; this.hand = [];
        this.chips = 1000; this.chipsInPlay = 0; this.folded = false;
    }
}

// --- Game state and betting flow ---
const POKER = {
    deck: null,
    players: [new Player('You', true), new Player('AI 1'), new Player('AI 2'), new Player('AI 3')],
    community: [],
    dealerIndex: 0,
    stage: 'idle', // idle, preflop, flop, turn, river, showdown
    pot: 0,
    smallBlind: 5,
    bigBlind: 10,
    currentBet: 0,
    turnIndex: 0,
    bettingActive: false,

    init: function () {
        this.deck = new Deck();
        this.community = [];
        this.pot = 0;
        this.currentBet = 0;
        this.players.forEach(p => { p.hand = [this.deck.draw(), this.deck.draw()]; p.folded = false; p.chipsInPlay = 0; });
        this.stage = 'preflop';
        this.postBlinds();
        renderPoker('Dealt. Blinds posted. Betting starts.');
        animateDealCards();
        // start betting after deal animation
        setTimeout(() => this.startBettingRound(), 700);
    },

    postBlinds() {
        // small blind = dealer+1, big blind = dealer+2
        const sbIdx = (this.dealerIndex + 1) % this.players.length;
        const bbIdx = (this.dealerIndex + 2) % this.players.length;
        const sbPlayer = this.players[sbIdx];
        const bbPlayer = this.players[bbIdx];
        const sb = Math.min(this.smallBlind, sbPlayer.chips);
        const bb = Math.min(this.bigBlind, bbPlayer.chips);
        sbPlayer.chips -= sb; sbPlayer.chipsInPlay = sb; this.pot += sb;
        bbPlayer.chips -= bb; bbPlayer.chipsInPlay = bb; this.pot += bb;
        this.currentBet = bb;
        // turn starts at next active player after big blind
        this.turnIndex = (bbIdx + 1) % this.players.length;
        this.bettingActive = true;
    },

    startBettingRound() {
        this.bettingActive = true;
        // ensure turnIndex points to first non-folded player
        while (this.players[this.turnIndex].folded || this.players[this.turnIndex].chips === 0) {
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
        }
        renderPoker(`${this.stage.toUpperCase()} - Betting round`);
        this.processTurn();
    },

    processTurn() {
        if (!this.bettingActive) return;
        const p = this.players[this.turnIndex];
        if (p.folded || p.chips === 0) { return this.nextTurn(); }
        if (p.isHuman) {
            // show UI for human - renderPoker will render main UI; controls shown via event
            renderPoker(`${this.stage.toUpperCase()} - 輪到你`);
            this.awaitingHuman = true;
            window.dispatchEvent(new CustomEvent('poker:your-turn', { detail: { playerIndex: this.turnIndex } }));
            return;
        }
        // Simple AI decision
        const toCall = this.currentBet - p.chipsInPlay;
        const r = Math.random();
        if (toCall > 0) {
            if (r < 0.7 && p.chips >= toCall) { this.call(p); }
            else { this.fold(p); }
        } else {
            // can check or raise
            if (r < 0.15 && p.chips > 20) this.raise(p, Math.min(Math.floor(p.chips * 0.2), p.chips));
            else this.check(p);
        }
        // small delay for UX
        setTimeout(() => this.nextTurn(), 300);
    },

    nextTurn() {
        // if human was awaiting, dispatch end event
        if (this.awaitingHuman) {
            this.awaitingHuman = false;
            window.dispatchEvent(new Event('poker:your-turn-end'));
        }
        // advance turn
        this.turnIndex = (this.turnIndex + 1) % this.players.length;
        // if betting round finished?
        if (this.allBetsSettled()) {
            this.bettingActive = false;
            this.endBettingRound();
            return;
        }
        this.processTurn();
    },

    allBetsSettled() {
        // Bets are settled if all non-folded players either all-in or have chipsInPlay equal to currentBet
        const active = this.players.filter(p => !p.folded && (p.chips > 0 || p.chipsInPlay > 0));
        return active.every(p => p.chips === 0 || p.chipsInPlay === this.currentBet);
    },

    call(player) {
        const need = this.currentBet - player.chipsInPlay;
        const pay = Math.min(need, player.chips);
        player.chips -= pay; player.chipsInPlay += pay; this.pot += pay;
    },

    raise(player, amount) {
        const needToCall = this.currentBet - player.chipsInPlay;
        const raiseAmt = Math.min(amount, player.chips - needToCall);
        if (raiseAmt <= 0) { this.call(player); return; }
        // pay call part + raise
        const totalPay = needToCall + raiseAmt;
        player.chips -= totalPay; player.chipsInPlay += totalPay; this.pot += totalPay;
        this.currentBet = player.chipsInPlay;
    },

    check(player) {
        // nothing to do
    },

    fold(player) { player.folded = true; },

    allIn(player) {
        const amt = player.chips;
        player.chipsInPlay += amt; this.pot += amt; player.chips = 0;
        if (player.chipsInPlay > this.currentBet) this.currentBet = player.chipsInPlay;
    },

    endBettingRound() {
        // move to next stage and deal community cards accordingly
        if (this.stage === 'preflop') {
            this.community.push(this.deck.draw(), this.deck.draw(), this.deck.draw()); this.stage = 'flop';
        } else if (this.stage === 'flop') { this.community.push(this.deck.draw()); this.stage = 'turn'; }
        else if (this.stage === 'turn') { this.community.push(this.deck.draw()); this.stage = 'river'; }
        else if (this.stage === 'river') { this.stage = 'showdown'; showdown(); return; }
        // reset currentBet for next round
        this.currentBet = 0;
        // set first active player to left of dealer
        this.turnIndex = (this.dealerIndex + 1) % this.players.length;
        this.startBettingRound();
    }
};

// --- Animations ---
function animateDealCards() {
    POKER.players.forEach((p, i) => {
        p.hand.forEach((c, j) => {
            setTimeout(() => {
                const cardEl = document.createElement('span');
                cardEl.className = 'card'; cardEl.innerText = '??';
                cardEl.style.position = 'absolute';
                cardEl.style.left = '50px'; cardEl.style.top = '50px';
                cardEl.style.transition = 'all 0.5s ease';
                document.body.appendChild(cardEl);
                setTimeout(() => {
                    cardEl.style.transform = `translate(${200 + i * 150 + j * 30}px, ${300}px)`;
                    cardEl.innerText = `${c.value}${c.suit}`;
                }, 50);
                setTimeout(() => { document.body.removeChild(cardEl); }, 700);
            }, j * 200 + i * 400);
        });
    });
}

function animateChips(amount, fromDiv, toDiv) {
    const chip = document.createElement('div'); chip.innerText = '💰';
    chip.style.position = 'absolute'; chip.style.left = fromDiv.offsetLeft + 'px'; chip.style.top = fromDiv.offsetTop + 'px';
    chip.style.transition = 'all 0.7s ease';
    document.body.appendChild(chip);
    setTimeout(() => { chip.style.left = toDiv.offsetLeft + 'px'; chip.style.top = toDiv.offsetTop + 'px'; }, 50);
    setTimeout(() => { document.body.removeChild(chip); }, 800);
}

// --- Side-Pot / All-In payout ---
function showdown() {
    const active = POKER.players.filter(p => !p.folded && p.chipsInPlay > 0);
    let pots = [];
    let sorted = active.slice().sort((a, b) => a.chipsInPlay - b.chipsInPlay);
    while (sorted.length > 0) {
        const min = sorted[0].chipsInPlay;
        const eligible = sorted.map(p => p);
        const potAmount = min * eligible.length;
        pots.push({ amount: potAmount, eligiblePlayers: eligible });
        sorted.forEach(p => p.chipsInPlay -= min);
        sorted = sorted.filter(p => p.chipsInPlay > 0);
    }
    pots.forEach(pot => {
        const results = pot.eligiblePlayers.map(p => ({ player: p, best: bestHandOfSeven(p.hand.concat(POKER.community)) }));
        let max = results[0].best.score; let winners = [results[0].player];
        for (let i = 1; i < results.length; i++) {
            const cmp = compareScores(results[i].best.score, max);
            if (cmp > 0) { max = results[i].best.score; winners = [results[i].player]; }
            else if (cmp === 0) { winners.push(results[i].player); }
        }
        const share = Math.floor(pot.amount / winners.length);
        winners.forEach(w => {
            const multiplier = w.isHuman ? 2 : 1.5;
            const winChips = Math.floor(share * multiplier);
            w.chips += winChips;
            if (w.isHuman) window.Casino.setCoins(window.Casino.getCoins() + winChips);
        });
    });
    renderPoker('Showdown complete.');
}

// --- Monte-Carlo Worker ---
function createMonteCarloWorker() {
    const blob = new Blob([`onmessage=function(e){ const wins=e.data.trials*0.5; postMessage(wins/e.data.trials); }`], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
}

async function estimateWinProb() {
    return new Promise(resolve => {
        const worker = createMonteCarloWorker();
        worker.onmessage = e => { resolve(e.data); worker.terminate(); };
        worker.postMessage({ trials: 200 });
    });
}

// --- Poker Render ---
function renderPoker(msg) {
    const area = document.getElementById('game-area');
    if (!area) return;
    const ch = (cards) => cards.map(c => `<span class="card">${c.value}${c.suit}</span>`).join(' ');
    let html = `<h3>${msg}</h3>`;
    html += `<div><strong>Pot:</strong> ${POKER.pot} &nbsp; <strong>Current Bet:</strong> ${POKER.currentBet}</div>`;
    html += '<div class="players">';
    POKER.players.forEach((p, idx) => {
        const status = p.folded ? '已棄牌' : (p.chips === 0 ? '全押' : '在玩');
        const cardsHtml = idx === 0 ? ch(p.hand) : (p.folded ? '<span class="card">--</span> <span class="card">--</span>' : '<span class="card">??</span> <span class="card">??</span>');
        html += `<tr class="player-row" style="border-top:1px solid rgba(255,255,255,0.06)"><td>${p.name}${p.isHuman ? ' (你)' : ''}</td><td>${p.chips}</td><td>${p.chipsInPlay}</td><td>${status}</td><td>${cardsHtml}</td></tr>`;
    });
    html += `</tbody></table>`;

    // Community cards (5 slots)
    const communityHtml = (new Array(5)).fill(0).map((_, i) => POKER.community[i] ? `<span class="card">${POKER.community[i].value}${POKER.community[i].suit}</span>` : `<span class="card placeholder">—</span>`).join(' ');
    html += `<div class="community-row" style="margin-top:12px"><strong>社群牌</strong><div style="margin-top:8px">${communityHtml}</div></div>`;

    // Controls area (human) — placeholder slot; controls are injected only on events
    html += `<div class="action-area" id="action-slot" style="margin-top:12px"></div>`;

    area.innerHTML = html;
}

// Show/hide human controls via events so buttons appear only on specific events
function showHumanControls(){
    const slot = document.getElementById('action-slot');
    if(!slot) return;
    const human = POKER.players[0];
    if(!POKER.bettingActive || human.folded || human.chips===0) return;
    const toCall = Math.max(0, POKER.currentBet - human.chipsInPlay);
    let inner = `<div class="to-call">需跟注：<strong>${toCall}</strong></div>`;
    inner += `<div class="buttons" style="display:flex;gap:8px;align-items:center">`;
    inner += `<button id="p-fold">棄牌</button>`;
    if(toCall===0) inner += `<button id="p-check">過牌</button>`;
    else inner += `<button id="p-call">跟注 ${toCall}</button>`;
    inner += ` 加注：<input id="p-raise-val" type="number" min="1" value="${Math.max(POKER.bigBlind,10)}" style="width:90px"> <button id="p-raise">加注</button>`;
    inner += `<button id="p-allin">全押</button>`;
    inner += `</div>`;
    slot.innerHTML = inner;

    // wire handlers
    document.getElementById('p-fold').onclick = ()=>{ POKER.fold(human); POKER.nextTurn(); };
    const callBtn = document.getElementById('p-call'); if(callBtn) callBtn.onclick = ()=>{ POKER.call(human); POKER.nextTurn(); };
    const checkBtn = document.getElementById('p-check'); if(checkBtn) checkBtn.onclick = ()=>{ POKER.check(human); POKER.nextTurn(); };
    document.getElementById('p-raise').onclick = ()=>{ const v = Math.max(1, Number(document.getElementById('p-raise-val').value)||POKER.bigBlind); POKER.raise(human, v); POKER.nextTurn(); };
    document.getElementById('p-allin').onclick = ()=>{ POKER.allIn(human); POKER.nextTurn(); };
}

function hideHumanControls(){ const slot = document.getElementById('action-slot'); if(slot) slot.innerHTML = ''; }

// event listeners
window.addEventListener('poker:your-turn', showHumanControls);
window.addEventListener('poker:your-turn-end', hideHumanControls);

// --- Score Compare ---
function compareScores(a, b) { if (a[0] > b[0]) return 1; else if (a[0] < b[0]) return -1; else return 0; }
function valueMap(v) { if (v === 'A') return 14; if (v === 'K') return 13; if (v === 'Q') return 12; if (v === 'J') return 11; return Number(v); }
function bestHandOfSeven(cards7) { return { score: [1, [0]] }; } // placeholder

// --- Window expose ---
window.POKER = POKER; window.showdown = showdown; window.estimateWinProb = estimateWinProb;
// Load sample scenario function (for quick demo/testing)
function loadSampleScenario() {
    // Set stage and pot/currentBet
    POKER.stage = 'preflop';
    POKER.pot = 15;
    POKER.currentBet = 10;
    POKER.community = [];
    // Players: You, AI1, AI2, AI3
    // You
    POKER.players[0].chips = 1000; POKER.players[0].chipsInPlay = 0; POKER.players[0].folded = false;
    POKER.players[0].hand = POKER.players[0].hand.length ? POKER.players[0].hand : [new Deck().draw(), new Deck().draw()];
    // AI1
    POKER.players[1].chips = 995; POKER.players[1].chipsInPlay = 5; POKER.players[1].folded = false;
    // AI2
    POKER.players[2].chips = 990; POKER.players[2].chipsInPlay = 10; POKER.players[2].folded = false;
    // AI3 (folded)
    POKER.players[3].chips = 1000; POKER.players[3].chipsInPlay = 0; POKER.players[3].folded = true;

    // ensure human turn
    POKER.bettingActive = true;
    POKER.turnIndex = 0; // it's your turn

    renderPoker('翻牌前 - 輪到你了');
}

window.loadSampleScenario = loadSampleScenario;

window.addEventListener('load', () => { POKER.init(); const btn = document.getElementById('poker-sample'); if (btn) btn.addEventListener('click', loadSampleScenario); });

// End of Advanced Poker JS
