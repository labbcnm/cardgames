(function () {
    // initialize coin balance in localStorage
    const KEY = 'midnight_coins_v1';
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, '1000');
    function updateUI() {
        document.querySelectorAll('#coin-amount').forEach(el => el.innerText = localStorage.getItem(KEY));
    }
    window.addEventListener('load', updateUI);
    window.Casino = {
        getCoins: () => Number(localStorage.getItem(KEY) || 0),
        setCoins: (v) => { localStorage.setItem(KEY, String(v)); document.querySelectorAll('#coin-amount').forEach(el => el.innerText = v); }
    }
})();
