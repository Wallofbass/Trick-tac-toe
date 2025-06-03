
const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const path = require("path");

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const players = {};
const ties = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Matchmaking
  let opponent = null;
  for (let id in players) {
    if (!players[id].opponent) {
      opponent = id;
      break;
    }
  }

  players[socket.id] = {
    opponent: opponent,
    score: 0
  };

  if (opponent) {
    players[opponent].opponent = socket.id;
    ties[socket.id] = 0;
    ties[opponent] = 0;
    io.to(socket.id).emit("playerNumber", 2);
    io.to(opponent).emit("playerNumber", 1);
    io.to(socket.id).emit("message", "Game start! You are Player 2.");
    io.to(opponent).emit("message", "Game start! You are Player 1.");
    io.to(socket.id).emit("updateTies", ties[socket.id]);
    io.to(opponent).emit("updateTies", ties[opponent]);
  }

  socket.on("gameWon", () => {
    if (players[socket.id]) {
      players[socket.id].score++;
      const playerScore = players[socket.id].score;
      const opponentId = players[socket.id].opponent;
      io.to(socket.id).emit("updateScore", playerScore);
      if (opponentId) {
        io.to(opponentId).emit("opponentScore", playerScore);
      }
    }
  });

  socket.on("gameTied", () => {
    const opponentId = players[socket.id]?.opponent;
    if (opponentId) {
      ties[socket.id]++;
      ties[opponentId]++;
      io.to(socket.id).emit("updateTies", ties[socket.id]);
      io.to(opponentId).emit("updateTies", ties[opponentId]);
    }
  });

  socket.on("restartGame", () => {
    const opponentId = players[socket.id]?.opponent;
    if (opponentId) {
      io.to(socket.id).emit("restartGame");
      io.to(opponentId).emit("restartGame");
    }
  });

  socket.on("disconnect", () => {
    const opponentId = players[socket.id]?.opponent;
    if (opponentId && players[opponentId]) {
      players[opponentId].opponent = null;
      io.to(opponentId).emit("message", "Your opponent has disconnected.");
    }
    delete players[socket.id];
    delete ties[socket.id];
    console.log("User disconnected:", socket.id);
  });
});

http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
