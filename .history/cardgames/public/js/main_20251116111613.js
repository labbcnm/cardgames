(function () {
    const KEY = 'midnight_coins_v2';
    const TX = 'midnight_tx_v1';
    const RATE_KEY = 'midnight_rate_v1';
    const COOLDOWN_KEY = 'midnight_cooldown_v1';

    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, '1000');
    if (!localStorage.getItem(TX)) localStorage.setItem(TX, JSON.stringify([]));
    if (!localStorage.getItem(RATE_KEY)) localStorage.setItem(RATE_KEY, '100');

    function updateUI() {
        document.querySelectorAll('#coin-amount').forEach(el => el.innerText = localStorage.getItem(KEY));
        const logEl = document.getElementById('tx-log');
        if (logEl) { const logs = JSON.parse(localStorage.getItem(TX) || '[]'); logEl.innerHTML = logs.map(l => `<div>${l.time} - ${l.type} ${l.amount} → ${l.result}</div>`).join(''); }
        const rateEl = document.getElementById('exchange-rate'); if (rateEl) rateEl.innerText = `1 USD = ${localStorage.getItem(RATE_KEY)} Coins`;
    }

    window.addEventListener('load', updateUI);

    window.Casino = {
        getCoins: () => Number(localStorage.getItem(KEY) || 0),
        setCoins: (v) => { localStorage.setItem(KEY, String(v)); document.querySelectorAll('#coin-amount').forEach(el => el.innerText = v); },
        txLog: () => JSON.parse(localStorage.getItem(TX) || '[]'),
        addTx: (entry) => { const logs = JSON.parse(localStorage.getItem(TX) || '[]'); logs.unshift(entry); localStorage.setItem(TX, JSON.stringify(logs)); updateUI(); }
    }

    function openExchange() {
        const modal = document.getElementById('exchange-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.setAttribute('aria-hidden', 'false');
        updateUI();
        // focus first control for accessibility
        const first = document.getElementById('exchange-amount') || modal.querySelector('button, input, select');
        if (first && typeof first.focus === 'function') first.focus();
    }

    function closeExchange() {
        const modal = document.getElementById('exchange-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
        // return focus to opener if available
        const opener = document.querySelector('#open-exchange');
        if (opener && typeof opener.focus === 'function') opener.focus();
    }

    function executeExchange() {
        const type = document.getElementById('exchange-type').value;
        const amt = Math.max(1, Math.floor(Number(document.getElementById('exchange-amount').value) || 0));
        const rate = Number(localStorage.getItem(RATE_KEY) || 100);
        const now = new Date().toLocaleString();
        if (type === 'buy') {
            const coins = amt * rate;
            const old = window.Casino.getCoins();
            window.Casino.setCoins(old + coins);
            const entry = { time: now, type: 'BUY', amount: `${amt} USD`, result: `${coins} Coins` };
            window.Casino.addTx(entry);
            document.getElementById('exchange-msg').innerText = `Bought ${coins} Coins`;
        } else {
            const coinsHave = window.Casino.getCoins();
            if (amt > coinsHave) { document.getElementById('exchange-msg').innerText = 'Not enough coins'; return; }
            const last = Number(localStorage.getItem(COOLDOWN_KEY) || '0');
            const nowTs = Date.now();
            if (nowTs - last < 10000) { document.getElementById('exchange-msg').innerText = 'Cooldown: please wait'; return; }
            const usd = (amt / rate).toFixed(2);
            window.Casino.setCoins(coinsHave - amt);
            localStorage.setItem(COOLDOWN_KEY, String(nowTs));
            const entry = { time: new Date().toLocaleString(), type: 'SELL', amount: `${amt} Coins`, result: `${usd} USD` };
            window.Casino.addTx(entry);
            document.getElementById('exchange-msg').innerText = `Sold ${amt} Coins for ${usd} USD`;
        }
    }

    window.addEventListener('load', () => {
        document.querySelectorAll('#open-exchange').forEach(b => b.addEventListener('click', openExchange));
        const closeBtn = document.getElementById('exchange-close'); if (closeBtn) closeBtn.addEventListener('click', closeExchange);
        const exDo = document.getElementById('exchange-do'); if (exDo) exDo.addEventListener('click', executeExchange);
        updateUI();
    });

})();
