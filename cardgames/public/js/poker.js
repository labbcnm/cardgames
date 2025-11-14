console.log('Poker JS Loaded');

class PokerDeck {
    constructor() {
        const suits = ['♠', '♥', '♦', '♣'];
        const vals = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        this.cards = [];
        for (let s of suits) for (let v of vals) this.cards.push({ suit: s, value: v });
        this.shuffle();
    }
    shuffle() { this.cards.sort(() => Math.random() - 0.5); }
    draw() { return this.cards.pop(); }
}

let deck, playerHand, dealerHand, community;

function startPoker() {
    deck = new PokerDeck();
    playerHand = [deck.draw(), deck.draw()];
    dealerHand = [deck.draw(), deck.draw()];
    community = [];
    renderPoker("Place your bet (demo mode)");
}

function nextStage() {
    if (community.length === 0) community.push(deck.draw(), deck.draw(), deck.draw());
    else if (community.length === 3) community.push(deck.draw());
    else if (community.length === 4) community.push(deck.draw());
    else return endPoker();
    renderPoker("Next Stage");
}

function endPoker() {
    const msg = "Winner: " + (Math.random() > 0.5 ? "YOU" : "DEALER");
    renderPoker(msg);
}

function renderPoker(message) {
    const g = document.getElementById('game-area');
    g.innerHTML = `
    <h2 style="color:#00ff88;">${message}</h2>

    <h3>Your Hand</h3>
    <p>${playerHand.map(c => c.value + c.suit).join(' ')}</p>

    <h3>Dealer</h3>
    <p>${dealerHand.map(c => "??").join(' ')}</p>

    <h3>Community Cards</h3>
    <p>${community.map(c => c.value + c.suit).join(' ')}</p>

    <button onclick="nextStage()">Next</button>
    <button onclick="startPoker()">Restart</button>
  `;
}

startPoker();
