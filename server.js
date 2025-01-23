const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const lobbies = new Map();
const users = new Map();
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
    console.log('User connected:', socket.id);
    
    socket.on('setUsername', (username) => {
        users.set(socket.id, username);
        socket.emit('lobbiesUpdate', Array.from(lobbies.values()).map(lobby => ({
            name: lobby.name,
            host: users.get(lobby.players[0].id)
        })));
    });

    socket.on('createLobby', ({ name, username }) => {
        if (!lobbies.has(name)) {
            lobbies.set(name, {
                name,
                players: [{ id: socket.id, cards: [] }],
                gameState: 'waiting',
                deck: generateDeck()
            });
            socket.join(name);
            socket.emit('lobbyCreated', name);
            io.emit('lobbiesUpdate', Array.from(lobbies.values()).map(lobby => ({
                name: lobby.name,
                host: users.get(lobby.players[0].id)
            })));
            console.log(`Lobby created: ${name} by ${username}`);
        }
    });

    socket.on('joinLobby', ({ name, username }) => {
        const lobby = lobbies.get(name);
        if (lobby && lobby.players.length < 2) {
            lobby.players.push({ id: socket.id, cards: [] });
            socket.join(name);
            
            if (lobby.players.length === 2) {
                const deck = lobby.deck;
                lobby.players[0].cards = deck.slice(0, CARDS_PER_PLAYER);
                lobby.players[1].cards = deck.slice(CARDS_PER_PLAYER);
                lobby.gameState = 'playing';
                lobby.currentPlayer = 0;
                
                const player1Username = users.get(lobby.players[0].id);
                const player2Username = users.get(lobby.players[1].id);
                
                io.to(lobby.players[0].id).emit('gameStart', {
                    player1Cards: lobby.players[0].cards,
                    player2Cards: lobby.players[1].cards,
                    currentPlayer: 0,
                    opponentUsername: player2Username
                });
                
                io.to(lobby.players[1].id).emit('gameStart', {
                    player1Cards: lobby.players[1].cards,
                    player2Cards: lobby.players[0].cards,
                    currentPlayer: 0,
                    opponentUsername: player1Username
                });
                
                console.log(`Game started in lobby: ${name} between ${player1Username} and ${player2Username}`);
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

                    // Check if game is over
                    if (lobby.players[0].cards.length === 0 && lobby.players[1].cards.length === 0) {
                        io.to(lobbyName).emit('gameOver');
                        lobbies.delete(lobbyName);
                        io.emit('lobbiesUpdate', Array.from(lobbies.values()).map(lobby => ({
                            name: lobby.name,
                            host: users.get(lobby.players[0].id)
                        })));
                    }
                }
                
                lobby.currentPlayer = 1 - lobby.currentPlayer;
                io.to(lobbyName).emit('turnChange', lobby.currentPlayer);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const username = users.get(socket.id);
        users.delete(socket.id);
        
        lobbies.forEach((lobby, lobbyName) => {
            if (lobby.players.some(p => p.id === socket.id)) {
                io.to(lobbyName).emit('playerDisconnected');
                lobbies.delete(lobbyName);
                io.emit('lobbiesUpdate', Array.from(lobbies.values()).map(lobby => ({
                    name: lobby.name,
                    host: users.get(lobby.players[0].id)
                })));
                console.log(`Lobby deleted: ${lobbyName} (${username} disconnected)`);
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
