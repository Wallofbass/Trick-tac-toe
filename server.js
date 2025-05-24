
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let waitingPlayer = null;
const rematchRequests = {};
const roomPlayers = {}; // Tracks players per room
const lastFirstPlayer = {}; // Tracks last starter to alternate turns

io.on('connection', socket => {
  console.log('A player connected:', socket.id);

  if (waitingPlayer) {
    const room = `room-${waitingPlayer.id}-${socket.id}`;
    socket.join(room);
    waitingPlayer.join(room);

    const symbols = {
      [waitingPlayer.id]: 'X',
      [socket.id]: 'O'
    };

    roomPlayers[room] = [waitingPlayer.id, socket.id];
    lastFirstPlayer[room] = waitingPlayer.id;

    io.to(room).emit('startGame', {
      room,
      players: roomPlayers[room],
      symbols
    });

    rematchRequests[room] = new Set();
    waitingPlayer = null;
  } else {
    waitingPlayer = socket;
    socket.emit('waiting');
  }

  socket.on('move', data => {
    socket.to(data.room).emit('opponentMove', data);
  });

  socket.on('guess', data => {
    socket.to(data.room).emit('opponentGuess', data);
  });

  socket.on('turnComplete', data => {
    socket.to(data.room).emit('turnComplete');
  });

  socket.on('rematchRequest', data => {
    const room = data.room;
    const clients = Array.from(io.sockets.adapter.rooms.get(room) || []);
    if (!clients.includes(socket.id)) return;

    rematchRequests[room] = rematchRequests[room] || new Set();
    rematchRequests[room].add(socket.id);

    if (rematchRequests[room].size === 2) {
      const [player1, player2] = roomPlayers[room];
      const previousStarter = lastFirstPlayer[room];
      const nextStarter = previousStarter === player1 ? player2 : player1;
      lastFirstPlayer[room] = nextStarter;

      const symbols = {
        [player1]: 'X',
        [player2]: 'O'
      };

      io.to(room).emit('gameRestarted', {
        room,
        players: [player1, player2],
        nextTurn: nextStarter,
        symbols
      });

      rematchRequests[room].clear();
    }
  });

  socket.on('disconnect', () => {
    console.log('A player disconnected:', socket.id);

    if (waitingPlayer === socket) {
      waitingPlayer = null;
    }

    for (const room in rematchRequests) {
      rematchRequests[room].delete(socket.id);
      if (roomPlayers[room]) {
        const otherPlayer = roomPlayers[room].find(id => id !== socket.id);
        if (otherPlayer) {
          io.to(otherPlayer).emit('opponentLeft');
        }
        delete roomPlayers[room];
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
