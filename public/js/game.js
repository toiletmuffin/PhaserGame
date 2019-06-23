const config = {
    type: Phaser.AUTO,
    parent: 'phaser-game',
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.image('background', 'assets/space.png');
    this.load.image('ship', 'assets/spaceShips_001.png');
    this.load.image('otherPlayer', 'assets/enemyBlack5.png');
    this.load.image('star', 'assets/star_gold.png');
    this.load.image('obstacle', 'assets/stone.png');
}

function create() {
    const self = this;
    this.socket = io();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.otherPlayers = this.physics.add.group();

    // Add background image to center of 800x600 area
    this.add.image(400, 300, 'background');

    this.obstacle = this.physics.add.sprite(400, 300, 'obstacle');
    // Set obstacle phsyics
    this.obstacle.setVelocity(100, 100);
    this.obstacle.setMaxVelocity(300);
    this.obstacle.setAcceleration(this.obstacle.body.velocity.x, this.obstacle.body.velocity.y);
    this.obstacle.setBounce(1).setCollideWorldBounds(true);

    this.blueScoreText = this.add.text(16, 16, '', { 
        fontSize: '24px', fontFamily: '"Roboto Condensed"', fill: '#6666FF' 
    });
    this.redScoreText = this.add.text(680, 16, '', { 
        fontSize: '24px', fontFamily: '"Roboto Condensed"', fill: '#FF6666' 
    });

    this.gameTime = this.add.text(375, 10, '', { 
        fontSize: '30px', fontFamily: '"Roboto Condensed"', fill: '#FFFFFF' 
    });


    this.socket.on('currentPlayers', (players) => {
        // Iterate through all player data and add players to the game
        Object.keys(players).forEach((id) => {
            if (players[id].playerId === self.socket.id) {
                addPlayer(self, players[id]);
            } else {
                addOtherPlayers(self, players[id]);
            }
        });
    });

    this.socket.on('newPlayer', (playerInfo) => {
        addOtherPlayers(self, playerInfo);
    });

    this.socket.on('disconnect', (playerId) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerId === otherPlayer.playerId) {
                otherPlayer.destroy();
            }
        });
    });

    this.socket.on('scoreUpdate', (scores) => {
        self.blueScoreText.setText('Blue: ' + scores.blue);
        self.redScoreText.setText('Red: ' + scores.red);
    });

    this.socket.on('timeUpdate', (time) => {
        self.gameTime.setText(time);
    });

    this.socket.on('gameEnd', (scores) => {
        if (scores.blue > scores.red) {
            self.gameTime.setText('Blue Wins');
        } else if (scores.red > scores.blue) {
            self.gameTime.setText('Red Wins');
        } else {
            self.gameTime.setText('Draw');
        }
    });

    this.socket.on('starLocation', (starLocation) => {
        if (self.star) self.star.destroy();
        self.star = self.physics.add.image(starLocation.x, starLocation.y, 'star');
        // Detect if ship overlaps with star
        self.physics.add.overlap(self.ship, self.star, () => {
            this.socket.emit('starCollected');
        }, null, self);
    });

    // Update the location of the player moved
    this.socket.on('playerMoved', (playerInfo) => {
        self.otherPlayers.getChildren().forEach((otherPlayer) => {
            if (playerInfo.playerId === otherPlayer.playerId) {
                otherPlayer.setRotation(playerInfo.rotation);
                otherPlayer.setPosition(playerInfo.x, playerInfo.y);
            }
        });
    });

    // Update the location of the obstacle
    this.socket.on('obstacleMoved', (movementData) => {
        self.obstacle.setAcceleration(self.obstacle.body.velocity.x, self.obstacle.body.velocity.y);
        self.obstacle.setPosition(movementData.x, movementData.y);
    });
}

function update() {
    if (this.ship) {
        if (this.cursors.left.isDown) {
            this.ship.setAngularVelocity(-150);
        } else if (this.cursors.right.isDown) {
            this.ship.setAngularVelocity(150);
        } else {
            this.ship.setAngularVelocity(0);
        }

        if (this.cursors.up.isDown) {
            this.physics.velocityFromRotation(this.ship.rotation + 1.5, 100, this.ship.body.acceleration);
        } else {
            this.ship.setAcceleration(0);
        }

        // Emit movements
        checkMovement(this, this.ship, 'playerMovement');
        checkMovement(this, this.obstacle, 'obstacleMovement');

        this.physics.world.addCollider(this.ship, this.obstacle, () => {
            this.socket.emit('obstacleHit');
        });
    }
}

function checkMovement(self, object, movementType) {
    let x = object.x;
    let y = object.y;
    let r = object.rotation;
    if (object.oldPosition && (x !== object.oldPosition.x || y !== object.oldPosition.y || r !== object.oldPosition.rotation)) {
        self.socket.emit(movementType, { x: object.x, y: object.y, rotation: object.rotation });
    }
    // Save old position data
    object.oldPosition = {
        x: object.x,
        y: object.y,
        rotation: object.rotation
    };
}

function addPlayer(self, playerInfo) {
    self.ship = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'ship').setOrigin(0.5, 0.5).setDisplaySize(53, 40);
    // Choose colour of the player ship
    if (playerInfo.team === 'blue') {
        self.ship.setTint(0x6666ff);
    } else {
        self.ship.setTint(0xff6666);
    }
    // Set physics of the player ship
    self.ship.setDrag(100);
    self.ship.setAngularDrag(100);
    self.ship.setMaxVelocity(200);
    self.ship.body.setBounce(2).setCollideWorldBounds(true);
}

function addOtherPlayers(self, playerInfo) {
    const otherPlayer = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer').setOrigin(0.5, 0.5).setDisplaySize(53, 40);
    if (playerInfo.team === 'blue') {
        otherPlayer.setTint(0x1111ff);
    } else {
        otherPlayer.setTint(0xff1111);
    }
    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);
}