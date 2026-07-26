const opponentsRow = document.getElementById('opponentsRow');
const discardPile = document.getElementById('discardPile');
const handRow = document.getElementById('handRow');
const turnBadge = document.getElementById('turnBadge');
const winsEl = document.getElementById('wins');
const colorOverlay = document.getElementById('colorOverlay');
const colorPicker = document.getElementById('colorPicker');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlaySub = document.getElementById('overlaySub');
const retryBtn = document.getElementById('retryBtn');
const drawBtn = document.getElementById('drawBtn');

const COLORS = ['rojo', 'verde', 'azul', 'amarillo'];
const HAND_SIZE = 7;
const BOT_NAMES = ['Bot Ana', 'Bot Leo', 'Bot Sol'];
const HUMAN = 'humano';
const WINS_KEY = 'arcade-lab:turno:partidas-ganadas';

let wins = Number(localStorage.getItem(WINS_KEY)) || 0;
winsEl.textContent = String(wins);

let deck, discard, hands, order, currentIndex, direction, currentColor, status, pendingWildIndex;

// ---------- Mazo ----------

function buildDeck() {
  const cards = [];
  for (const color of COLORS) {
    cards.push({ color, tipo: 'numero', valor: 0 });
    for (let v = 1; v <= 9; v++) {
      cards.push({ color, tipo: 'numero', valor: v });
      cards.push({ color, tipo: 'numero', valor: v });
    }
    for (let i = 0; i < 2; i++) {
      cards.push({ color, tipo: 'salta' });
      cards.push({ color, tipo: 'reversa' });
      cards.push({ color, tipo: '+2' });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ color: null, tipo: 'comodin' });
    cards.push({ color: null, tipo: 'comodin+4' });
  }
  return cards;
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawOne() {
  if (deck.length === 0) {
    const top = discard.pop();
    deck = shuffle(discard);
    discard = [top];
  }
  return deck.pop();
}

function drawCards(playerId, count) {
  for (let i = 0; i < count; i++) hands[playerId].push(drawOne());
}

function canPlay(card, topCard) {
  if (card.tipo === 'comodin' || card.tipo === 'comodin+4') return true;
  if (card.color === currentColor) return true;
  if (card.tipo === 'numero' && topCard.tipo === 'numero' && card.valor === topCard.valor) return true;
  if (card.tipo !== 'numero' && card.tipo === topCard.tipo) return true;
  return false;
}

function moveIndex(steps) {
  const n = order.length;
  currentIndex = (((currentIndex + direction * steps) % n) + n) % n;
}

// ---------- Arrancar partida ----------

function resetGame() {
  deck = shuffle(buildDeck());
  discard = [];
  order = [HUMAN, ...BOT_NAMES];
  hands = {};
  for (const id of order) hands[id] = [];
  for (const id of order) drawCards(id, HAND_SIZE);

  // La primera carta del descarte nunca es un comodin+4 ni +2, para no
  // arrancar castigando a alguien antes de jugar
  let first;
  do {
    first = drawOne();
    if (first.tipo === 'comodin+4' || first.tipo === '+2') deck.unshift(first);
  } while (first.tipo === 'comodin+4' || first.tipo === '+2');
  discard.push(first);
  currentColor = first.color || COLORS[Math.floor(Math.random() * COLORS.length)];

  currentIndex = 0;
  direction = 1;
  status = 'playing';
  pendingWildIndex = null;
  overlay.classList.remove('visible');
  colorOverlay.classList.remove('visible');
  render();
  maybeBotTurn();
}

function topCard() {
  return discard[discard.length - 1];
}

// ---------- Jugar una carta ----------

function playCard(playerId, index, chosenColor) {
  const card = hands[playerId][index];
  if (!card) return false;
  if (!canPlay(card, topCard())) return false;

  hands[playerId].splice(index, 1);
  discard.push(card);
  currentColor = card.color || chosenColor || COLORS[0];

  if (hands[playerId].length === 0) {
    return endGame(playerId);
  }

  applyEffect(card);
  render();
  maybeBotTurn();
  return true;
}

function applyEffect(card) {
  switch (card.tipo) {
    case 'salta':
      moveIndex(2);
      break;
    case 'reversa':
      direction *= -1;
      moveIndex(order.length === 2 ? 2 : 1);
      break;
    case '+2': {
      const targetIdx = (((currentIndex + direction) % order.length) + order.length) % order.length;
      drawCards(order[targetIdx], 2);
      moveIndex(2);
      break;
    }
    case 'comodin+4': {
      const targetIdx = (((currentIndex + direction) % order.length) + order.length) % order.length;
      drawCards(order[targetIdx], 4);
      moveIndex(2);
      break;
    }
    default:
      moveIndex(1);
  }
}

function drawForTurn(playerId) {
  if (order[currentIndex] !== playerId || status !== 'playing') return;
  drawCards(playerId, 1);
  moveIndex(1);
  render();
  maybeBotTurn();
}

function endGame(winnerId) {
  status = 'finished';
  render();
  if (winnerId === HUMAN) {
    wins++;
    localStorage.setItem(WINS_KEY, String(wins));
    winsEl.textContent = String(wins);
    overlayTitle.textContent = 'GANASTE';
    overlayTitle.className = 'overlay-title win';
    overlaySub.textContent = `Te quedaste sin cartas primero. Partidas ganadas: ${wins}`;
  } else {
    overlayTitle.textContent = 'PERDISTE';
    overlayTitle.className = 'overlay-title lose';
    overlaySub.textContent = `${winnerId} se quedó sin cartas primero.`;
  }
  overlay.classList.add('visible');
  return true;
}

// ---------- Turno del bot ----------

function maybeBotTurn() {
  if (status !== 'playing') return;
  const current = order[currentIndex];
  if (current === HUMAN) return render();
  setTimeout(() => botPlay(current), 700);
}

function botPlay(botId) {
  if (status !== 'playing' || order[currentIndex] !== botId) return;
  const hand = hands[botId];
  let chosenIndex = hand.findIndex((c) => c.tipo !== 'comodin' && c.tipo !== 'comodin+4' && canPlay(c, topCard()));
  if (chosenIndex === -1) chosenIndex = hand.findIndex((c) => canPlay(c, topCard()));

  if (chosenIndex === -1) {
    drawCards(botId, 1);
    moveIndex(1);
    render();
    maybeBotTurn();
    return;
  }

  const card = hand[chosenIndex];
  let chosenColor = null;
  if (card.tipo === 'comodin' || card.tipo === 'comodin+4') {
    const counts = { rojo: 0, verde: 0, azul: 0, amarillo: 0 };
    for (const c of hand) if (c.color) counts[c.color]++;
    chosenColor = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  playCard(botId, chosenIndex, chosenColor);
}

// ---------- Interacción del jugador humano ----------

function humanPlayCard(index) {
  if (status !== 'playing' || order[currentIndex] !== HUMAN) return;
  const card = hands[HUMAN][index];
  if (!canPlay(card, topCard())) return;

  if (card.tipo === 'comodin' || card.tipo === 'comodin+4') {
    pendingWildIndex = index;
    colorOverlay.classList.add('visible');
    return;
  }
  playCard(HUMAN, index, null);
}

colorPicker.querySelectorAll('.color-swatch').forEach((sw) => {
  sw.addEventListener('click', () => {
    colorOverlay.classList.remove('visible');
    if (pendingWildIndex === null) return;
    const index = pendingWildIndex;
    pendingWildIndex = null;
    playCard(HUMAN, index, sw.dataset.color);
  });
});

retryBtn.addEventListener('click', resetGame);
drawBtn.addEventListener('click', () => drawForTurn(HUMAN));

// ---------- Dibujo ----------

function cardLabel(card) {
  if (card.tipo === 'numero') return String(card.valor);
  if (card.tipo === 'salta') return '🚫';
  if (card.tipo === 'reversa') return '🔄';
  if (card.tipo === '+2') return '+2';
  if (card.tipo === 'comodin') return '🃏';
  if (card.tipo === 'comodin+4') return '+4';
  return '?';
}

function cardClass(card) {
  if (card.tipo === 'comodin' || card.tipo === 'comodin+4') return 'comodin';
  return card.color;
}

function render() {
  // Oponentes
  opponentsRow.innerHTML = BOT_NAMES.map((name) => {
    const active = order[currentIndex] === name;
    return `
      <div class="opponent${active ? ' active' : ''}">
        <span class="opponent-name">${name}</span>
        <span class="card back" style="width:32px;height:46px;font-size:0.8rem">🂠</span>
        <span class="opponent-count">${hands[name] ? hands[name].length : 0} cartas</span>
      </div>
    `;
  }).join('');

  // Pila de descarte
  const top = topCard();
  discardPile.innerHTML = `<div class="card ${cardClass(top)}">${cardLabel(top)}</div>`;
  discardPile.title = `Color activo: ${currentColor}`;

  // Mano del humano
  const esMiTurno = status === 'playing' && order[currentIndex] === HUMAN;
  handRow.innerHTML = hands[HUMAN]
    .map((card, i) => {
      const jugable = esMiTurno && canPlay(card, top);
      return `<div class="card ${cardClass(card)}${jugable ? '' : ' disabled'}" data-index="${i}">${cardLabel(card)}</div>`;
    })
    .join('');

  handRow.querySelectorAll('.card').forEach((el) => {
    el.addEventListener('click', () => humanPlayCard(Number(el.dataset.index)));
  });

  if (status === 'playing') {
    if (esMiTurno) {
      const puedeJugar = hands[HUMAN].some((c) => canPlay(c, top));
      turnBadge.textContent = puedeJugar ? 'Tu turno — elegí una carta' : 'Tu turno — no tenés jugada';
      drawBtn.style.display = puedeJugar ? 'none' : '';
    } else {
      turnBadge.textContent = `Turno de ${order[currentIndex]}...`;
      drawBtn.style.display = 'none';
    }
  } else {
    drawBtn.style.display = 'none';
  }
}

resetGame();
