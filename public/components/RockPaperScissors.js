import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io();

const RockPaperScissors = () => {
  const [lobbyName, setLobbyName] = useState('');
  const [gameState, setGameState] = useState('menu');
  const [availableLobbies, setAvailableLobbies] = useState([]);
  const [playerCards, setPlayerCards] = useState([]);
  const [opponentCards, setOpponentCards] = useState([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [roundResult, setRoundResult] = useState(null);

  useEffect(() => {
    socket.on('lobbiesUpdate', (lobbies) => {
      setAvailableLobbies(lobbies);
    });

    socket.on('lobbyCreated', (name) => {
      setLobbyName(name);
      setGameState('waiting');
    });

    socket.on('gameStart', ({ player1Cards, player2Cards, currentPlayer }) => {
      const isPlayer1 = socket.id === socket.id;
      setPlayerCards(isPlayer1 ? player1Cards : player2Cards);
      setOpponentCards(isPlayer1 ? player2Cards : player1Cards);
      setIsMyTurn(currentPlayer === (isPlayer1 ? 0 : 1));
      setGameState('playing');
    });

    socket.on('turnChange', (currentPlayer) => {
      const isPlayer1 = socket.id === socket.id;
      setIsMyTurn(currentPlayer === (isPlayer1 ? 0 : 1));
    });

    socket.on('roundResult', ({ player1Card, player2Card, winner, player1Cards, player2Cards }) => {
      const isPlayer1 = socket.id === socket.id;
      setPlayerCards(isPlayer1 ? player1Cards : player2Cards);
      setOpponentCards(isPlayer1 ? player2Cards : player1Cards);
      setRoundResult({ 
        playerCard: isPlayer1 ? player1Card : player2Card,
        opponentCard: isPlayer1 ? player2Card : player1Card,
        winner
      });
      setTimeout(() => setRoundResult(null), 3000);
    });

    socket.on('playerDisconnected', () => {
      setGameState('menu');
      alert('Opponent disconnected');
    });

    return () => {
      socket.off('lobbiesUpdate');
      socket.off('lobbyCreated');
      socket.off('gameStart');
      socket.off('turnChange');
      socket.off('roundResult');
      socket.off('playerDisconnected');
    };
  }, []);

  const createLobby = () => {
    const name = prompt('Enter lobby name:');
    if (name) {
      socket.emit('createLobby', name);
    }
  };

  const joinLobby = (name) => {
    socket.emit('joinLobby', name);
    setLobbyName(name);
    setGameState('waiting');
  };

  const playCard = (card) => {
    if (isMyTurn) {
      socket.emit('playCard', { lobbyName, card });
    }
  };

  const renderCard = (type) => (
    <div 
      className={`w-24 h-32 border-2 rounded-lg flex items-center justify-center cursor-pointer 
        ${isMyTurn ? 'hover:bg-blue-100' : 'opacity-50'} bg-white`}
      onClick={() => playCard(type)}
    >
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </div>
  );

  if (gameState === 'menu') {
    return (
      <div className="p-4">
        <h1 className="text-2xl mb-4">Rock Paper Scissors</h1>
        <button 
          className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
          onClick={createLobby}
        >
          Create Lobby
        </button>
        <h2 className="text-xl mb-2">Available Lobbies:</h2>
        <div className="space-y-2">
          {availableLobbies.map(lobby => (
            <div 
              key={lobby}
              className="border p-2 rounded cursor-pointer hover:bg-gray-100"
              onClick={() => joinLobby(lobby)}
            >
              {lobby}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div className="p-4">
        <h1 className="text-2xl mb-4">Waiting for opponent...</h1>
        <p>Lobby: {lobbyName}</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">Rock Paper Scissors</h1>
      <div className="mb-4">
        <h2 className="text-xl">Opponent's Cards ({opponentCards.length})</h2>
        <div className="flex gap-2 flex-wrap">
          {opponentCards.map((_, i) => (
            <div key={i} className="w-24 h-32 border-2 rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>
      
      {roundResult && (
        <div className="mb-4 p-4 bg-blue-100 rounded">
          <p>You played: {roundResult.playerCard}</p>
          <p>Opponent played: {roundResult.opponentCard}</p>
          <p>Result: {roundResult.winner === 'draw' ? 'Draw!' : 
            roundResult.winner === (socket.id === socket.id ? 'player1' : 'player2') ? 
            'You won!' : 'You lost!'}</p>
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-xl">Your Cards {isMyTurn ? '(Your Turn)' : ''}</h2>
        <div className="flex gap-2 flex-wrap">
          {playerCards.map((card, i) => (
            <div key={i}>{renderCard(card)}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RockPaperScissors;
