console.log('Blackjack JS loaded');

class Deck {
    constructor() {
        this.cards = [];
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        for (let s of suits) for (let v of values) this.cards.push({ suit: s, value: v });
        this.shuffle();
    }
    shuffle() { this.cards.sort(() => Math.random() - 0.5); }
    draw() { return this.cards.pop(); }
}

function calcValue(hand) {
    let total = 0, aces = 0;
    for (let c of hand) {
        if (c.value === 'A') aces++;
        else if (['J', 'Q', 'K'].includes(c.value)) total += 10;
        else total += Number(c.value);
    }
    for (let i = 0; i < aces; i++) total += (total + 11 <= 21) ? 11 : 1;
    return total;
}

let deck, player, dealer;

function startGame() {
    deck = new Deck();
    player = [deck.draw(), deck.draw()];
    dealer = [deck.draw(), deck.draw()];
    render();
}

function hit() {
    player.push(deck.draw());
    if (calcValue(player) > 21) endGame();
    render();
}

function stand() { endGame(); }

function endGame() {
    while (calcValue(dealer) < 17) dealer.push(deck.draw());
    const pv = calcValue(player);
    const dv = calcValue(dealer);
    let result = '';
    if (pv > 21) result = 'You Bust!';
    else if (dv > 21) result = 'Dealer Bust! You Win!';
    else if (pv > dv) result = 'You Win!';
    else if (pv < dv) result = 'You Lose!';
    else result = 'Tie!';
    document.getElementById('result').innerText = result;
}

function render() {
    const area = document.getElementById('game-area');
    area.innerHTML = `
    <h2>Dealer (${calcValue(dealer)})</h2>
    <p>${dealer.map(c => c.value + c.suit).join(' ')}</p>
    <h2>You (${calcValue(player)})</h2>
    <p>${player.map(c => c.value + c.suit).join(' ')}</p>
    <button onclick="hit()">Hit</button>
    <button onclick="stand()">Stand</button>
    <h2 id="result"></h2>
  `;
}

startGame();
