// montecarlo-worker.js
// Web Worker for Monte Carlo win probability estimation

self.onmessage = function(e) {
    const { hand, community, numPlayers, trials } = e.data;
    // Poker logic helpers (copied from main script, but only最小必要)
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

    let wins = 0;
    for (let t = 0; t < trials; t++) {
        // 構建完整牌組
        const suits = ['♠', '♥', '♦', '♣'];
        const vals = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        let deck = [];
        for (let s of suits) for (let v of vals) deck.push({ suit: s, value: v });
        // 移除已知手牌與社群牌
        const known = [...hand, ...community];
        const knownSet = new Set(known.map(c => c.value + c.suit));
        deck = deck.filter(c => !knownSet.has(c.value + c.suit));
        // 隨機分配其他玩家手牌
        let others = [];
        for (let i = 1; i < numPlayers; i++) {
            others.push([deck.pop(), deck.pop()]);
        }
        // 補齊社群牌
        let comm = community.slice();
        while (comm.length < 5) comm.push(deck.pop());
        // 計算所有玩家最佳牌型
        let all = [hand].concat(others);
        let results = all.map(h => bestHandOfSeven(h.concat(comm)));
        let myScore = results[0].score;
        let win = true;
        for (let i = 1; i < results.length; i++) {
            if (compareScores(results[i].score, myScore) > 0) { win = false; break; }
        }
        if (win) wins++;
    }
    postMessage(wins / trials);
};
