// Game configuration object
const config = {
    type: Phaser.AUTO, // Use WebGL if available, otherwise Canvas
    width: 800,
    height: 600,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false // Set to true to see physics bodies
        }
    },
    scene: [MenuScene, GameScene] // The scenes to load, MenuScene first
};

// Create a new Phaser game instance
const game = new Phaser.Game(config);