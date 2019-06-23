const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);
const PORT = process.env.PORT || 8081;

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('A user connected');
  // Create a new player and add it to our players object
  players[socket.id] = {
    rotation: 0,
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50,
    playerId: socket.id,
    team: ((numPlayers % 2) == 0) ? 'red' : 'blue'
  };
  numPlayers++;

  // Send the players object to the new player
  socket.emit('currentPlayers', players);
  // Send the star object to the new player
  socket.emit('starLocation', star);
  // Send the current scores
  socket.emit('scoreUpdate', scores);
  // Start game time when more than 2 people
  if (numPlayers >= 2 && (gameTimer === null)) {
    gameTimer = startGameTime(socket, gameTime);
  }


  // Update all other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('disconnect', () => {
    console.log('A user disconnected');

    // Remove this player from our players object
    delete players[socket.id];
    numPlayers--;
    // Emit a message to all players to remove this player
    io.emit('disconnect', socket.id);
  });

  // When a player moves, update the player data
  socket.on('playerMovement', (movementData) => {
    players[socket.id].x = movementData.x;
    players[socket.id].y = movementData.y;
    players[socket.id].rotation = movementData.rotation;
    // Emit a message to all players about the player that moved
    io.emit('playerMoved', players[socket.id]);
  });

  // When an obstacle moves, update obstacle data
  socket.on('obstacleMovement', (movementData) => {
    io.emit('obstacleMoved', movementData);
  });

  socket.on('starCollected', () => {
    if (players[socket.id].team === 'red') {
      scores.red += 100;
    } else {
      scores.blue += 100;
    }
    // Randomize a new star location
    star.x = Math.floor(Math.random() * 700) + 50;
    star.y = Math.floor(Math.random() * 500) + 50;
    io.emit('starLocation', star);
    io.emit('scoreUpdate', scores);
  });

  socket.on('obstacleHit', () => {
    let teamHit = players[socket.id].team;
    // Avoid over-triggering deduction of points
    if (!recentlyHit[teamHit]) {
      // Decrease 5 points for team that hit the obstacle
      scores[teamHit] -= 50;
      recentlyHit[teamHit] = true;
    }
    // Cooldown after being hit
    setTimeout((recentlyHit, teamHit) => {
      recentlyHit[teamHit] = false
    }, 2000, recentlyHit, teamHit);
    io.emit('scoreUpdate', scores);
  });
});

let numPlayers = 0;
let players = {};
let star = {
  x: Math.floor(Math.random() * 700) + 50,
  y: Math.floor(Math.random() * 500) + 50
};
let scores = {
  blue: 1000,
  red: 1000
};
let recentlyHit = {
  blue: false,
  red: false
};
let gameTime = 60;
let gameTimer = null;

function startGameTime(socket, gameTime) {
  return setInterval(() => {
    if (gameTime > 0) {
      // Broadcast game time every second
      socket.emit('timeUpdate', gameTime);
      socket.broadcast.emit('timeUpdate', gameTime);
      gameTime--;
    } else {
      // Broadcast end game signal
      socket.emit('gameEnd', scores);
      socket.broadcast.emit('gameEnd', scores);
      clearInterval(gameTimer);
      setTimeout(restartGame, 5000);
    }
  }, 1000);
}

function restartGame() {
  console.log('Restarting game');
  scores = {
    blue: 1000,
    red: 1000
  };
  gameTime = 60;
  gameTimer = null;
}

server.listen(PORT, () => {
  console.log('Listening on ' + server.address().port);
});