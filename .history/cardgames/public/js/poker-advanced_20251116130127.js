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
        this.showOne = false; // whether one hole card is revealed to the table
    }
}

// --- Game state and betting flow ---
const POKER = {
    deck: null,
    players: [],
    community: [],
    dealerIndex: 1,
    stage: 'idle', // idle, preflop, flop, turn, river, showdown
    pot: 0,
    smallBlind: 5,
    bigBlind: 10,
    currentBet: 0,
    turnIndex: 0,
    bettingActive: false,

    init: function () {
        // 依據 #poker-players 數量建立玩家
        let numPlayers = 2;
        const input = document.getElementById('poker-players');
        if (input) {
            numPlayers = Math.max(2, Math.min(8, parseInt(input.value) || 2));
        }
        this.deck = new Deck();
        this.players = [];
        this.players.push(new Player('You', true));
        for (let i = 1; i < numPlayers; i++) {
            this.players.push(new Player('AI ' + i));
        }
        this.community = [];
        this.pot = 0;
        this.currentBet = 0;
        this.dealerIndex = 1 % this.players.length;
        this.players.forEach(p => { p.hand = [this.deck.draw(), this.deck.draw()]; p.folded = false; p.chipsInPlay = 0; p.seen = false; });
        this.stage = 'preflop';
        this.postBlinds();
        renderPoker('Dealt. Blinds posted. Betting starts.');
        animateDealCards();
        setTimeout(() => showViewCardsButton(), 700);
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
            // reveal one card of each opponent and dealer's one card before asking
            this.players.forEach((pl, idx) => { if (idx > 0 && !pl.folded) pl.showOne = true; });
            if (this.dealerIndex !== 0 && !this.players[this.dealerIndex].folded) this.players[this.dealerIndex].showOne = true;
            renderPoker(`${this.stage.toUpperCase()} - 輪到你`);
            this.awaitingHuman = true;
            // dispatch event that it's player's turn (UI will present dealer prompt)
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
    // 檢查每位玩家手牌+社群牌是否足夠比牌
    const minCards = Math.min(...active.map(p => (p.hand.length + POKER.community.length)));
    if (minCards < 5) {
        renderPoker('牌數不足，無法比牌！');
        return;
    }
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
        const results = pot.eligiblePlayers.map(p => {
            const best = bestHandOfSeven(p.hand.concat(POKER.community));
            if (!best || !best.score) return null;
            return { player: p, best };
        }).filter(Boolean);
        if (results.length === 0) return;
        let max = results[0].best.score; let winners = [results[0].player];
        for (let i = 1; i < results.length; i++) {
            if (!results[i] || !results[i].best || !results[i].best.score) continue;
            const cmp = compareScores(results[i].best.score, max);
            if (cmp > 0) { max = results[i].best.score; winners = [results[i].player]; }
            else if (cmp === 0) { winners.push(results[i].player); }
        }
        const share = Math.floor(pot.amount / winners.length);
        winners.forEach(w => {
            const multiplier = w.isHuman ? 2 : 1.5;
            const winChips = Math.floor(share * multiplier);
            w.chips += winChips;
            if (w.isHuman) {
                if (window.Casino && typeof window.Casino.getCoins === 'function' && typeof window.Casino.setCoins === 'function') {
                    const cur = Number(window.Casino.getCoins() || 0);
                    window.Casino.setCoins(cur + winChips);
                } else {
                    try { console.warn('Casino API not available — skipping coin credit'); } catch (e) { }
                }
            }
        });
    });
    renderPoker('Showdown complete.');
}

// --- Monte-Carlo Worker ---
let monteWorker = null;
function getMonteCarloWorker() {
    if (!monteWorker) {
        monteWorker = new Worker('js/montecarlo-worker.js');
    }
    return monteWorker;
}

async function estimateWinProb(hand, community, numPlayers = 2, trials = 200) {
    return new Promise(resolve => {
        const worker = getMonteCarloWorker();
        const handler = e => { resolve(e.data); worker.removeEventListener('message', handler); };
        worker.addEventListener('message', handler);
        worker.postMessage({ hand, community, numPlayers, trials });
    });
}

// --- Poker Render ---
function renderPoker(msg) {
    const area = document.getElementById('game-area');
    if (!area) return;
    const ch = (cards) => cards.map(c => `<span class="card">${c.value}${c.suit}</span>`).join(' ');
    let html = `<h3>${msg}</h3>`;
    html += `<div><strong>Pot:</strong> ${POKER.pot} &nbsp; <strong>Current Bet:</strong> ${POKER.currentBet}</div>`;
    // players table
    html += '<table class="players"><thead><tr><th>玩家</th><th>籌碼</th><th>投入</th><th>狀態</th><th>手牌</th></tr></thead><tbody>';
    POKER.players.forEach((p, idx) => {
        const status = p.folded ? '已棄牌' : (p.chips === 0 ? '全押' : '在玩');
        let cardsHtml = '';
        // 玩家手牌只在玩家自己選擇查看時顯示（seen），否則覆蓋
        if (idx === 0) cardsHtml = p.seen ? ch(p.hand) : '<span class="card">??</span> <span class="card">??</span>';
        else if (p.folded) cardsHtml = '<span class="card">--</span> <span class="card">--</span>';
        else if (p.showOne && p.hand.length >= 1) cardsHtml = `<span class="card">${p.hand[0].value}${p.hand[0].suit}</span> <span class="card">??</span>`;
        else cardsHtml = '<span class="card">??</span> <span class="card">??</span>';
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

// Dealer-driven prompt: when it's player's turn, dealer 'asks' the player to call or fold
function showHumanControls() {
    const slot = document.getElementById('action-slot');
    if (!slot) return;
    const human = POKER.players[0];
    if (!POKER.bettingActive || human.folded || human.chips === 0) return;
    const toCall = Math.max(0, POKER.currentBet - human.chipsInPlay);
    // Build a simple dealer prompt in the action slot (modal-like)
    let inner = `<div class="dealer-prompt" style="border:1px solid #ccc;padding:12px;background:#111;color:#fff;max-width:420px">`;
    inner += `<div style="margin-bottom:8px"><strong>莊家問：</strong>是否要跟注 <strong>${toCall}</strong>？</div>`;
    inner += `<div style="display:flex;gap:8px;align-items:center">`;
    inner += `<button id="p-dealer-call">跟注 ${toCall}</button>`;
    inner += `<button id="p-dealer-fold">棄牌</button>`;
    inner += `<input id="p-dealer-raise-val" type="number" min="1" value="${Math.max(POKER.bigBlind, 10)}" style="width:90px"> <button id="p-dealer-raise">加注</button>`;
    inner += `<button id="p-dealer-allin">全押</button>`;
    inner += `</div></div>`;
    slot.innerHTML = inner;
    // mark awaitingHuman true so keyboard shortcuts will work
    POKER.awaitingHuman = true;

    // handlers perform action then advance turn
    document.getElementById('p-dealer-fold').onclick = () => { POKER.fold(human); hideHumanControls(); POKER.nextTurn(); };
    document.getElementById('p-dealer-call').onclick = () => { POKER.call(human); hideHumanControls(); POKER.nextTurn(); };
    document.getElementById('p-dealer-raise').onclick = () => { const v = Math.max(1, Number(document.getElementById('p-dealer-raise-val').value) || POKER.bigBlind); POKER.raise(human, v); hideHumanControls(); POKER.nextTurn(); };
    document.getElementById('p-dealer-allin').onclick = () => { POKER.allIn(human); hideHumanControls(); POKER.nextTurn(); };
}

function hideHumanControls() {
    const slot = document.getElementById('action-slot'); if (slot) slot.innerHTML = '';
    // hide revealed single cards after the player's decision
    POKER.players.forEach(pl => { pl.showOne = false; });
    // re-render to hide reveals
    POKER.awaitingHuman = false;
    renderPoker(`${POKER.stage.toUpperCase()} - 繼續`);
}

// event listeners
// Event-driven UX: show a small floating "回應莊家" button when it's player's turn.
function showRespondButton() {
    // ensure any existing respond btn removed
    hideRespondButton();
    const btn = document.createElement('button');
    btn.id = 'poker-respond';
    btn.innerText = '莊家詢問 — 點此回應';
    btn.style.position = 'fixed'; btn.style.right = '18px'; btn.style.bottom = '18px';
    btn.style.zIndex = 2000; btn.style.padding = '10px 14px'; btn.style.borderRadius = '8px';
    btn.style.background = '#222'; btn.style.color = '#fff'; btn.style.border = '1px solid rgba(255,255,255,0.08)'; btn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
    btn.onclick = () => { showHumanControls(); hideRespondButton(); };
    document.body.appendChild(btn);
}

function hideRespondButton() { const ex = document.getElementById('poker-respond'); if (ex) ex.remove(); }

// View Cards floating button: player uses this to see their two hole cards
function showViewCardsButton() {
    hideViewCardsButton();
    const btn = document.createElement('button');
    btn.id = 'poker-viewcards';
    btn.innerText = '查看手牌';
    btn.style.position = 'fixed'; btn.style.left = '18px'; btn.style.bottom = '18px';
    btn.style.zIndex = 2000; btn.style.padding = '10px 14px'; btn.style.borderRadius = '8px';
    btn.style.background = '#144'; btn.style.color = '#fff'; btn.style.border = '1px solid rgba(255,255,255,0.08)'; btn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
    btn.onclick = () => {
        // reveal player's cards locally
        const human = POKER.players[0]; if (!human) return;
        human.seen = true; // mark that player has seen their cards
        hideViewCardsButton();
        renderPoker('你查看了你的手牌');
        // set awaitingHuman and dispatch event so dealer asks
        POKER.awaitingHuman = true;
        window.dispatchEvent(new CustomEvent('poker:your-turn', { detail: { playerIndex: 0 } }));
    };
    document.body.appendChild(btn);
}

function hideViewCardsButton() { const ex = document.getElementById('poker-viewcards'); if (ex) ex.remove(); }

window.addEventListener('poker:your-turn', () => { showRespondButton(); });
window.addEventListener('poker:your-turn-end', () => { hideRespondButton(); hideHumanControls(); });

// Keyboard shortcuts while awaiting human action: C=call, F=fold, R=raise, A=all-in
window.addEventListener('keydown', (e) => {
    if (!POKER.awaitingHuman) return;
    const human = POKER.players[0];
    if (!human || human.folded || human.chips === 0) return;
    const key = e.key.toLowerCase();
    if (key === 'c') { POKER.call(human); hideHumanControls(); POKER.nextTurn(); }
    else if (key === 'f') { POKER.fold(human); hideHumanControls(); POKER.nextTurn(); }
    else if (key === 'a') { POKER.allIn(human); hideHumanControls(); POKER.nextTurn(); }
    else if (key === 'r') { const amt = Math.max(POKER.bigBlind, 10); POKER.raise(human, amt); hideHumanControls(); POKER.nextTurn(); }
});

// --- Score Compare ---
// --- Evaluator (copied from poker.js) ---
function valueMap(v) { if (v === 'A') return 14; if (v === 'K') return 13; if (v === 'Q') return 12; if (v === 'J') return 11; return Number(v); }
function combinations(arr, k) { const res = []; (function r(start, comb) { if (comb.length === k) { res.push(comb.slice()); return; } for (let i = start; i < arr.length; i++) { comb.push(arr[i]); r(i + 1, comb); comb.pop(); } })(0, []); return res; }
function rankCounts(cards) { const counts = {}; cards.forEach(c => counts[c.value] = (counts[c.value] || 0) + 1); return counts; }
function isFlush(cards) { const suits = {}; cards.forEach(c => suits[c.suit] = (suits[c.suit] || 0) + 1); for (let s in suits) if (suits[s] >= 5) return true; return false; }
function isStraight(values) { const set = new Set(values); const arr = Array.from(set).sort((a, b) => a - b); if (set.has(14)) arr.unshift(1); let consec = 1, best = 1; for (let i = 1; i < arr.length; i++) { if (arr[i] === arr[i - 1] + 1) { consec++; best = Math.max(best, consec); } else consec = 1; } return best >= 5; }

function evaluate5(cards) {
    const vals = cards.map(c => valueMap(c.value)).sort((a, b) => b - a);
    const counts = rankCounts(cards);
    const groups = Object.entries(counts).map(([v, c]) => ({ v: valueMap(v), c })).sort((a, b) => b.c - a.c || b.v - a.v);
    const is_flush = isFlush(cards);
    const is_straight = isStraight(vals);
    let straightFlush = false;
    const suits = ['♠', '♥', '♦', '♣'];
    for (let s of suits) {
        const bySuit = cards.filter(c => c.suit === s);
        if (bySuit.length >= 5 && isStraight(bySuit.map(c => valueMap(c.value)))) { straightFlush = true; break; }
    }
    if (straightFlush) return [9, vals];
    if (groups[0].c === 4) return [8, [groups[0].v, groups[1].v]];
    if (groups[0].c === 3 && groups[1] && groups[1].c >= 2) return [7, [groups[0].v, groups[1].v]];
    if (is_flush) return [6, vals];
    if (is_straight) return [5, vals];
    if (groups[0].c === 3) return [4, [groups[0].v].concat(vals)];
    if (groups[0].c === 2 && groups[1] && groups[1].c === 2) return [3, [groups[0].v, groups[1].v].concat(vals)];
    if (groups[0].c === 2) return [2, [groups[0].v].concat(vals)];
    return [1, vals];
}

function bestHandOfSeven(cards7) { const combs = combinations(cards7, 5); let best = null; for (let c of combs) { const score = evaluate5(c); if (!best) best = { score, hand: c }; else { const [aLevel, aTie] = score; const [bLevel, bTie] = best.score; if (aLevel > bLevel) best = { score, hand: c }; else if (aLevel === bLevel) { for (let i = 0; i < Math.max(aTie.length, bTie.length); i++) { const av = aTie[i] || 0; const bv = bTie[i] || 0; if (av > bv) { best = { score, hand: c }; break; } else if (av < bv) break; } } } } return best; }

function compareScores(a, b) { if (a[0] !== b[0]) return a[0] - b[0]; for (let i = 1; i < Math.max(a[1].length, b[1].length); i++) { const av = a[1][i] || 0; const bv = b[1][i] || 0; if (av !== bv) return av - bv; } return 0; }

// --- Window expose ---
window.POKER = POKER; window.showdown = showdown; window.estimateWinProb = estimateWinProb;

window.addEventListener('load', () => {
    POKER.init();
    // 下注按鈕
    const betBtn = document.getElementById('poker-bet-btn');
    if (betBtn) betBtn.addEventListener('click', () => {
        const val = Math.max(0, Math.floor(Number(document.getElementById('poker-bet')?.value) || 0));
        const human = POKER.players[0];
        if (!human) return alert('玩家不存在');
        if (val <= 0) return alert('請輸入有效下注金額');
        if (val > human.chips) return alert('籌碼不足');
        human.chips -= val; human.chipsInPlay += val; POKER.pot += val;
        if (val > POKER.currentBet) POKER.currentBet = human.chipsInPlay;
        renderPoker(`已下注 ${val}`);
        if (!POKER.bettingActive) setTimeout(() => POKER.startBettingRound(), 200);
    });
    // 揭示按鈕
    const revealBtn = document.getElementById('poker-reveal');
    if (revealBtn) revealBtn.addEventListener('click', () => { showdown(); });
    // 重新開始按鈕
    const restartBtn = document.getElementById('poker-restart');
    if (restartBtn) restartBtn.addEventListener('click', () => { POKER.init(); });
    // 玩家數輸入框
    const playerInput = document.getElementById('poker-players');
    if (playerInput) playerInput.addEventListener('change', () => { POKER.init(); });
    // 下一階段按鈕
    const nextBtn = document.getElementById('poker-next');
    if (nextBtn) nextBtn.addEventListener('click', () => {
        // 依照目前階段推進流程
        if (POKER.stage === 'preflop') {
            POKER.community.push(POKER.deck.draw(), POKER.deck.draw(), POKER.deck.draw());
            POKER.stage = 'flop';
        } else if (POKER.stage === 'flop') {
            POKER.community.push(POKER.deck.draw());
            POKER.stage = 'turn';
        } else if (POKER.stage === 'turn') {
            POKER.community.push(POKER.deck.draw());
            POKER.stage = 'river';
        } else if (POKER.stage === 'river') {
            POKER.stage = 'showdown';
            showdown();
            return;
        }
        renderPoker(`進入 ${POKER.stage}`);
    });
});

// End of Advanced Poker JS
