
const socket = io();

let room = null;
let playerId = null;
let isMyTurn = false;
let board = Array(9).fill('');
let star = null;
let waitingForMove = true;
let mySymbol = null;
let opponentSymbol = null;
let hasGuessed = false;
let rematchRequested = false;
let opponentIsDone = false;

const boardEl = document.getElementById('board');
const messageEl = document.getElementById('message');
const restartBtn = document.getElementById('restartBtn');

function renderBoard() {
  boardEl.innerHTML = '';
  board.forEach((cell, i) => {
    const cellEl = document.createElement('div');
    cellEl.className = 'cell';
    cellEl.textContent = cell;
    cellEl.onclick = () => {
      if (!isMyTurn || !opponentIsDone) return;

      if (waitingForMove) {
        if (board[i] !== '') return;
        if (star !== null && i === star) {
          flashMessage("BOOM! Move blocked!");
          socket.emit('move', { room, index: null });
          socket.emit('turnComplete', { room });
          isMyTurn = false;
          opponentIsDone = false;
          return;
        }

        board[i] = mySymbol;
        renderBoard();
        socket.emit('move', { room, index: i });

        if (checkWinner()) {
          messageEl.textContent = "You win!";
          document.querySelectorAll('.cell').forEach(cell => cell.onclick = null);
          restartBtn.style.display = 'inline-block';
          return;
        } else if (board.every(cell => cell !== '')) {
          messageEl.textContent = "It's a draw!";
          restartBtn.style.display = 'inline-block';
          return;
        }

        waitingForMove = false;
        messageEl.textContent = "Now guess your opponent's next move.";
      } else if (!hasGuessed) {
        if (board[i] === '') {
          star = i;
          socket.emit('guess', { room, index: star });
          socket.emit('turnComplete', { room });
          hasGuessed = true;
          isMyTurn = false;
          opponentIsDone = false;
          messageEl.textContent = "Waiting for opponent...";
        }
      }
    };
    boardEl.appendChild(cellEl);
  });
}

function flashMessage(msg) {
  messageEl.textContent = msg;
  messageEl.style.color = 'red';
  setTimeout(() => {
    messageEl.style.color = 'black';
    renderBoard();
    star = null;
    isMyTurn = false;
    waitingForMove = true;
    opponentIsDone = false;
    messageEl.textContent = "Waiting for opponent...";
  }, 1000);
}

function checkWinner() {
  const wins = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  return wins.some(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
}

restartBtn.onclick = () => {
  if (!rematchRequested) {
    rematchRequested = true;
    socket.emit('rematchRequest', { room });
    messageEl.textContent = "Waiting for opponent to confirm rematch...";
  }
};

socket.on('waiting', () => {
  messageEl.textContent = 'Waiting for another player to join...';
});

socket.on('startGame', data => {
  room = data.room;
  playerId = socket.id;
  mySymbol = data.symbols[playerId];
  opponentSymbol = mySymbol === 'X' ? 'O' : 'X';
  isMyTurn = data.players[0] === socket.id;
  board = Array(9).fill('');
  star = null;
  waitingForMove = true;
  hasGuessed = false;
  rematchRequested = false;
  opponentIsDone = isMyTurn ? true : false;
  renderBoard();
  messageEl.textContent = isMyTurn ? 'Your turn to move!' : "Opponent is making a move...";
  restartBtn.style.display = 'none';
});

socket.on('opponentMove', data => {
  if (data.index !== null) {
    board[data.index] = opponentSymbol;
  }
  if (checkWinner()) {
    messageEl.textContent = "You lose!";
    document.querySelectorAll('.cell').forEach(cell => cell.onclick = null);
    restartBtn.style.display = 'inline-block';
    return;
  } else if (board.every(cell => cell !== '')) {
    messageEl.textContent = "It's a draw!";
    restartBtn.style.display = 'inline-block';
    return;
  }

  waitingForMove = true;
  isMyTurn = true;
  hasGuessed = false;
  opponentIsDone = false;
  star = null;
  renderBoard();
  messageEl.textContent = "Waiting for opponent to finish guessing...";
});

socket.on('opponentGuess', data => {
  star = data.index;
});

socket.on('turnComplete', () => {
  opponentIsDone = true;
  renderBoard();
  messageEl.textContent = "Your turn to move!";
});

socket.on('opponentLeft', () => {
  messageEl.textContent = "Your opponent left the game.";
  isMyTurn = false;
  document.querySelectorAll('.cell').forEach(cell => cell.onclick = null);
  restartBtn.style.display = 'none';
});

socket.on('gameRestarted', data => {
  board = Array(9).fill('');
  star = null;
  waitingForMove = true;
  isMyTurn = socket.id === data.nextTurn;
  mySymbol = data.symbols[socket.id];
  opponentSymbol = mySymbol === 'X' ? 'O' : 'X';
  hasGuessed = false;
  rematchRequested = false;
  opponentIsDone = isMyTurn;
  renderBoard();
  messageEl.textContent = isMyTurn ? "Your turn to move!" : "Opponent is making a move...";
  restartBtn.style.display = 'none';
});
