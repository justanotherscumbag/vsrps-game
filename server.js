const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

const lobbies = new Map();
const CARDS_PER_PLAYER = 15;

function generateDeck() {
  const cards = [];
  const types = ['rock', 'paper', 'scissors'];
  for (let i = 0; i < CARDS_PER_PLAYER * 2; i++) {
    cards.push(types[i % 3]);
  }
  return cards.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
  socket.on('createLobby', (lobbyName) => {
    if (!lobbies.has(lobbyName)) {
      lobbies.set(lobbyName, {
        players: [{ id: socket.id, cards: [] }],
        gameState: 'waiting',
        deck: generateDeck()
      });
      socket.join(lobbyName);
      socket.emit('lobbyCreated', lobbyName);
      io.emit('lobbiesUpdate', Array.from(lobbies.keys()));
    }
  });

  socket.on('joinLobby', (lobbyName) => {
    const lobby = lobbies.get(lobbyName);
    if (lobby && lobby.players.length < 2) {
      lobby.players.push({ id: socket.id, cards: [] });
      socket.join(lobbyName);
      
      if (lobby.players.length === 2) {
        const deck = lobby.deck;
        lobby.players[0].cards = deck.slice(0, CARDS_PER_PLAYER);
        lobby.players[1].cards = deck.slice(CARDS_PER_PLAYER);
        lobby.gameState = 'playing';
        lobby.currentPlayer = 0;
        
        io.to(lobbyName).emit('gameStart', {
          player1Cards: lobby.players[0].cards,
          player2Cards: lobby.players[1].cards,
          currentPlayer: lobby.currentPlayer
        });
      }
    }
  });

  socket.on('playCard', ({ lobbyName, card }) => {
    const lobby = lobbies.get(lobbyName);
    if (!lobby) return;

    const playerIndex = lobby.players.findIndex(p => p.id === socket.id);
    if (playerIndex === lobby.currentPlayer) {
      const player = lobby.players[playerIndex];
      const opponent = lobby.players[1 - playerIndex];

      if (player.cards.includes(card)) {
        player.currentCard = card;
        player.cards = player.cards.filter(c => c !== card);
        
        if (opponent.currentCard) {
          const result = determineWinner(player.currentCard, opponent.currentCard);
          io.to(lobbyName).emit('roundResult', {
            player1Card: lobby.players[0].currentCard,
            player2Card: lobby.players[1].currentCard,
            winner: result,
            player1Cards: lobby.players[0].cards,
            player2Cards: lobby.players[1].cards
          });
          
          player.currentCard = null;
          opponent.currentCard = null;
        }
        
        lobby.currentPlayer = 1 - lobby.currentPlayer;
        io.to(lobbyName).emit('turnChange', lobby.currentPlayer);
      }
    }
  });

  socket.on('disconnect', () => {
    lobbies.forEach((lobby, lobbyName) => {
      if (lobby.players.some(p => p.id === socket.id)) {
        io.to(lobbyName).emit('playerDisconnected');
        lobbies.delete(lobbyName);
        io.emit('lobbiesUpdate', Array.from(lobbies.keys()));
      }
    });
  });
});

function determineWinner(card1, card2) {
  if (card1 === card2) return 'draw';
  if (
    (card1 === 'rock' && card2 === 'scissors') ||
    (card1 === 'paper' && card2 === 'rock') ||
    (card1 === 'scissors' && card2 === 'paper')
  ) {
    return 'player1';
  }
  return 'player2';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
