// This defines a new scene for our game called 'GameScene'.
// Phaser scenes are the building blocks of a game, like different screens or levels.
class GameScene extends Phaser.Scene {
    // The constructor is a special function that runs when a new GameScene is created.
    constructor() {
        // 'super' calls the constructor of the parent class (Phaser.Scene) and sets a unique key for this scene.
        super({ key: 'GameScene' });

        // --- Player Properties ---
        this.player = null; // This will hold the player's sprite object.
        this.playerSpeed = 400; // Sets the movement speed of the player in pixels per second.
        this.playerHealth = 4; // The player's current health.
        this.maxHealth = 4; // The maximum health the player can have.
        this.isPlayerInvincible = false; // A flag to check if the player can take damage.

        // --- Input Properties ---
        this.cursors = null; // Will hold the keyboard arrow key input object.
        this.keys = null; // Will hold the keyboard WASD key input object.

        // --- Weapon Properties ---
        this.projectiles = null; // A group to manage all player projectiles.
        this.fireCooldown = 2000; // Time in milliseconds between shots.
        this.lastFired = 0; // Timestamp of when the player last fired a projectile.

        // --- Enemy Properties ---
        this.enemies = null; // A group to manage all enemy objects.

        // --- HUD (Heads-Up Display) Properties ---
        this.healthIcons = []; // An array to store the heart icons for the health display.
        this.timerText = null; // The text object for the survival timer.
        this.survivalTime = 0; // The total time the player has survived, in milliseconds.

        // --- Experience/Leveling Properties ---
        this.orbs = null; // A group to manage all experience orbs.
        this.orbCount = 0; // The player's current XP count.
        this.playerLevel = 1; // The player's current level.
        this.orbsToLevel = 10; // The number of orbs needed to level up.
        this.levelText = null; // The text object for displaying the player's level.
        this.playerExp = 0; // The player's current experience points (same as orbCount).
        this.expText = null; // The text object for displaying the player's XP.

        // --- Enemy Type Definitions ---
        // An array of objects, each defining a different type of enemy.
        this.enemyTypes = [
            { key: 'red', color: 0xff0000, behavior: 'track' },       // Tracks the player.
            { key: 'blue', color: 0x3399ff, behavior: 'straight' },    // Moves in a straight line towards the player's predicted position.
            { key: 'green', color: 0x33ff33, behavior: 'diagonal' },  // Bounces off the screen edges diagonally.
            { key: 'yellow', color: 0xffff33, behavior: 'sinusoidal' } // Moves in a wave pattern.
        ];
        this.upgradeMenu = null; // This will hold the container for the level-up menu.

        // --- Upgrade Definitions ---
        // A fixed list of upgrades the player can choose from upon leveling up.
        this.upgradeOptions = [
            { 
                name: '+1 Max Health', // The name of the upgrade.
                apply: () => { // The function that applies the upgrade.
                    this.maxHealth++; // Increase max health by one.
                    // Also give the player 1 heart immediately if they aren't at max health.
                    if (this.playerHealth < this.maxHealth) {
                        this.playerHealth++;
                    }
                } 
            },
            { name: '+15% Speed', apply: () => { this.playerSpeed = Math.round(this.playerSpeed * 1.15); } }, // Increases player speed.
            { name: '-20% Cooldown', apply: () => { this.fireCooldown = Math.max(200, Math.round(this.fireCooldown * 0.8)); } }, // Reduces weapon cooldown.
            { name: '+1 Projectile', apply: () => { this.projectileCount++; } } // Increases the number of projectiles fired at once.
        ];
        this.isUpgradeMenuOpen = false; // A flag to check if the upgrade menu is currently open.
        this.playerShape = 'circle'; // The default shape for the player character.
        this.projectileCount = 1; // The number of projectiles the player fires at once.
        this.cooldownBarBg = null; // The background of the weapon cooldown bar.
        this.cooldownBarFill = null; // The fill part of the weapon cooldown bar.
        this.cooldownLabel = null; // The text label for the cooldown bar.
        this.gameWon = false; // A flag to check if the player has won the game.
        this.winTime = 200000; // The survival time in milliseconds required to win.
        this.dpad = null; // The container for the on-screen D-pad for mobile.
        this.isMobile = false; // A flag to determine if the game is running on a mobile-sized screen.

        // --- Game Over State ---
        this.gameOver = false; // A flag to check if the game is over.
        this.gameOverContainer = null; // The container for the game over screen UI.
    }

    // The init method is called when a scene starts. It receives data passed from another scene.
    init(data) {
        // Check if data was passed and if it contains a playerShape property.
        if (data && data.playerShape) {
            this.playerShape = data.playerShape; // Set the player's shape based on the selection from the main menu.
        }
        // Adjust initial weapon cooldown and projectile count based on the selected shape.
        if (this.playerShape === 'circle') {
            this.fireCooldown = 4000; // Circles have a moderate cooldown.
            this.projectileCount = 6; // Circles fire a wide spread of projectiles.
        } else if (this.playerShape === 'triangle') {
            this.fireCooldown = 2000; // Triangles have a moderate cooldown.
            this.projectileCount = 3; // Triangles fire a 3-shot burst.
        } else if (this.playerShape === 'square') {
            this.fireCooldown = 3000; // Squares have a moderate cooldown.
            this.projectileCount = 4; // Squares fire in four directions.
        }
    }

    // The create method is called once, after init, to set up all the game objects.
    create() {
        // --- Player Setup ---
        // Create the player sprite in the center of the screen. 'null' is used because we'll generate the texture dynamically.
        this.player = this.physics.add.sprite(this.sys.game.config.width / 2, this.sys.game.config.height / 2, null);
        this.player.body.setCircle(16); // Set a circular physics body for the player.
        this.player.setCollideWorldBounds(true); // Prevent the player from moving outside the game screen.
        this.createPlayerTexture(); // Call the helper function to draw the player's shape.

        // --- Input Setup ---
        this.cursors = this.input.keyboard.createCursorKeys(); // Enable keyboard arrow keys.
        this.keys = this.input.keyboard.addKeys('W,A,S,D'); // Enable WASD keys.

        // --- Mobile D-Pad Setup ---
        // Check if the game width is small enough to be considered a mobile device.
        this.isMobile = this.sys.game.config.width < 768;
        if (this.isMobile) {
            this.createDPad(); // If it's mobile, create the on-screen D-pad.
        }

        // --- HUD Setup ---
        this.createHUD(); // Call the helper function to create all HUD elements.

        // --- Weapon System Setup ---
        // Create a physics group for projectiles. This makes managing them easier.
        this.projectiles = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite, // All objects in this group will be arcade sprites.
            runChildUpdate: true // The update method of each child will be called automatically.
        });

        // --- Enemy System Setup ---
        // Create a physics group for enemies.
        this.enemies = this.physics.add.group({
            runChildUpdate: true,
            classType: Phaser.Physics.Arcade.Sprite
        });

        // --- Orbs Group ---
        this.orbs = this.physics.add.group(); // Create a physics group for XP orbs.

        // --- Enemy Spawn Timer ---
        this.baseSpawnDelay = 150; // The initial delay between enemy spawns in milliseconds.
        this.currentSpawnDelay = this.baseSpawnDelay; // The current spawn delay, which can change.
        this.lastSpawnAdjust = 0; // A tracker for when the spawn rate was last adjusted.
        // Create a timer event that repeatedly calls the spawnEnemy function.
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        // Spawn some enemies at the start of the game to get the action going.
        for (let i = 1; i < 10; i++) {
            this.spawnEnemy('red'); // Spawn a specific type of enemy ('red').
        }

        // --- Collision Setup ---
        // Check for collisions between projectiles and enemies, and call projectileHitEnemy if they collide.
        this.physics.add.collider(this.projectiles, this.enemies, this.projectileHitEnemy, null, this);
        // Check for overlaps between the player and enemies, and call playerHitEnemy if they overlap.
        this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);
        // Check for overlaps between the player and orbs, and call collectOrb if they overlap.
        this.physics.add.overlap(this.player, this.orbs, this.collectOrb, null, this);

        // --- Depth Sorting ---
        // Loop through all game objects to set their depth (rendering order).
        this.children.list.forEach(child => {
            // Note: Depths are set explicitly when objects are created to ensure correct layering.
        });

        // --- Reset Scene States ---
        this.gameOver = false; // Reset the game over flag if the scene is restarted.
        this.isUpgradeMenuOpen = false; // Reset the upgrade menu flag.
    }

    // The update method is called on every frame of the game.
    update(time, delta) {
        // If the upgrade menu is open or the game is over, pause most game logic.
        if (this.isUpgradeMenuOpen || this.gameOver) {
            this.updateHUD(delta); // Only update the HUD (like the timer).
            return; // Stop further execution of the update loop.
        }

        // --- Win Condition Check ---
        if (!this.gameWon && this.survivalTime >= this.winTime) {
            this.gameWon = true; // Set the game won flag.
            this.showWinScreen(); // Display the win screen.
            return; // Stop the update loop.
        }

        // --- Dynamic Spawn Rate Scaling ---
        // Calculate elapsed seconds to adjust difficulty over time.
        const elapsedSec = Math.floor(this.survivalTime / 500);
        // Every 10 "units" of time, adjust the spawn delay.
        if (elapsedSec - this.lastSpawnAdjust >= 20) {
            this.lastSpawnAdjust = elapsedSec;
            // Slightly decrease the spawn delay over time to spawn enemies faster (Note: 1.00 is not a change, should be < 1.0).
            this.currentSpawnDelay *= 0.80; 
            this.spawnTimer.reset({ delay: this.currentSpawnDelay, callback: this.spawnEnemy, callbackScope: this, loop: true });
        }

        // --- Handle Core Game Logic ---
        this.handlePlayerMovement(); // Check for and apply player movement input.
        this.handlePlayerShooting(time); // Handle the player's automatic shooting.
        this.updateHUD(delta); // Update the HUD elements.
        this.cleanupOutOfBounds(); // Remove objects that are far off-screen.
    }

    // --- Creation Helpers ---

    // A function to dynamically create the player's texture based on their chosen shape.
    createPlayerTexture() {
        const graphics = this.add.graphics(); // Create a temporary graphics object for drawing.
        if (this.playerShape === 'circle') {
            graphics.fillStyle(0xffffff, 1); // Set the fill color to white.
            graphics.fillCircle(16, 16, 16); // Draw a circle.
            graphics.generateTexture('playerCircle', 32, 32); // Create a texture from the drawing.
            this.player.setTexture('playerCircle'); // Apply the texture to the player sprite.
        } else if (this.playerShape === 'triangle') {
            graphics.fillStyle(0x00ffcc, 1); // Set color to cyan.
            graphics.fillTriangle(4, 28, 16, 0, 28, 28); // Draw a triangle.
            graphics.generateTexture('playerTriangle', 32, 32);
            this.player.setTexture('playerTriangle');
        } else if (this.playerShape === 'square') {
            graphics.fillStyle(0xffa500, 1); // Set color to orange.
            graphics.fillRect(0, 0, 32, 32); // Draw a square.
            graphics.generateTexture('playerSquare', 32, 32);
            this.player.setTexture('playerSquare');
        }
        graphics.destroy(); // Destroy the temporary graphics object.

        // Set the player's depth to be above enemies but below the HUD.
        this.player.setDepth(200);
    }

    // A function to create all the HUD elements.
    createHUD() {
        // --- Health Display (Hearts) ---
        this.healthIcons = []; // Clear any existing health icons.
        for (let i = 0; i < this.maxHealth; i++) {
            const heart = this.add.graphics(); // Create a graphics object for each heart.
            heart.fillStyle(0xff0000, 1); // Set color to red.
            // Draw a heart shape using a triangle and two circles.
            heart.fillTriangle(10, 0, 0, 10, 20, 10);
            heart.fillCircle(5, 10, 5);
            heart.fillCircle(15, 10, 5);
            heart.x = 20 + (i * 25); // Position each heart next to the previous one.
            heart.y = 20;
            heart.setDepth(1000); // Set depth to 1000 to ensure it's on top of everything.
            this.healthIcons.push(heart); // Add the heart to our array.
        }

        // --- Survival Timer ---
        // Create the timer text object in the top-center of the screen.
        this.timerText = this.add.text(this.sys.game.config.width / 2, 20, 'Time: 00:00', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5, 0);
        this.timerText.setDepth(1000);

        // --- Player Level Display ---
        // Create the level text in the top-right.
        this.levelText = this.add.text(this.sys.game.config.width - 30, 20, `Lv. ${this.playerLevel}`, {
            fontSize: '24px',
            fill: '#ffff00',
            align: 'right'
        }).setOrigin(1, 0); // Origin (1,0) aligns it to the right.
        this.levelText.setDepth(1000);

        // --- Player Experience Display ---
        // Create the XP text below the level text.
        this.expText = this.add.text(this.sys.game.config.width - 30, 50, `EXP: ${this.orbCount}/10`, {
            fontSize: '20px',
            fill: '#00ccff',
            align: 'right'
        }).setOrigin(1, 0);
        this.expText.setDepth(1000);

        // --- Weapon Cooldown Progress Bar ---
        const barWidth = 400;
        const barHeight = 18;
        const barY = this.sys.game.config.height - 40;
        const barX = this.sys.game.config.width / 2 - barWidth / 2;
        // Create the background of the bar.
        this.cooldownBarBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0x222222, 0.7).setOrigin(0, 0.5);
        this.cooldownBarBg.setDepth(1000);
        // Create the fill of the bar, which will change in width.
        this.cooldownBarFill = this.add.rectangle(barX, barY, 0, barHeight, 0x00ff66, 1).setOrigin(0, 0.5);
        this.cooldownBarFill.setDepth(1000);
        // Create the label for the bar.
        this.cooldownLabel = this.add.text(this.sys.game.config.width / 2, barY - 18, 'Weapon Cooldown', { fontSize: '16px', fill: '#fff' }).setOrigin(0.5, 1);
        this.cooldownLabel.setDepth(1000);
    }

    // A function to create the on-screen D-pad for mobile controls.
    createDPad() {
        const dpadSize = 120;
        const dpadX = 80; // Position in the bottom-left corner.
        const dpadY = this.sys.game.config.height - 80;

        // Create a container to hold all D-pad elements.
        this.dpad = this.add.container(dpadX, dpadY);

        // --- D-pad Background ---
        const bg = this.add.circle(0, 0, dpadSize / 2, 0x333333, 0.7);
        this.dpad.add(bg);

        // --- Directional Buttons ---
        const directions = [
            { key: 'up', x: 0, y: -40, angle: -90 },
            { key: 'down', x: 0, y: 40, angle: 90 },
            { key: 'left', x: -40, y: 0, angle: 180 },
            { key: 'right', x: 40, y: 0, angle: 0 }
        ];

        this.dpadButtons = {}; // An object to track the state of each button.
        directions.forEach(dir => {
            const btn = this.add.circle(dir.x, dir.y, 25, 0x666666, 0.8)
                .setInteractive() // Make the button clickable/touchable.
                .on('pointerdown', () => this.dpadButtons[dir.key] = true) // When pressed, set state to true.
                .on('pointerup', () => this.dpadButtons[dir.key] = false)   // When released, set state to false.
                .on('pointerout', () => this.dpadButtons[dir.key] = false); // When pointer leaves, set to false.
            this.dpad.add(btn);
            this.dpadButtons[dir.key] = false; // Initialize state to false.
        });

        this.dpad.setDepth(500); // Set depth to be below the main HUD but above the game world.
    }

    // --- Update Handlers ---

    // Handles player movement based on input.
    handlePlayerMovement() {
        // If the game is paused, stop player movement.
        if (this.isUpgradeMenuOpen || this.gameOver) {
            if (this.player && this.player.body) this.player.body.setVelocity(0, 0);
            return;
        }

        this.player.body.setVelocity(0); // Reset velocity to 0 each frame to prevent sliding.
        let moveX = 0; // Horizontal movement direction (-1 for left, 1 for right).
        let moveY = 0; // Vertical movement direction (-1 for up, 1 for down).

        // Check for mobile D-pad input.
        if (this.isMobile) {
            if (this.dpadButtons.up) moveY = -1;
            if (this.dpadButtons.down) moveY = 1;
            if (this.dpadButtons.left) moveX = -1;
            if (this.dpadButtons.right) moveX = 1;
        } else {
            // Check for keyboard input (WASD and arrow keys).
            if (this.keys.A.isDown || this.cursors.left.isDown) moveX = -1;
            else if (this.keys.D.isDown || this.cursors.right.isDown) moveX = 1;
            if (this.keys.W.isDown || this.cursors.up.isDown) moveY = -1;
            else if (this.keys.S.isDown || this.cursors.down.isDown) moveY = 1;
        }

        // Normalize the movement vector to prevent faster diagonal movement.
        const magnitude = Math.sqrt(moveX * moveX + moveY * moveY);
        if (magnitude > 0) {
            this.player.body.setVelocity((moveX / magnitude) * this.playerSpeed, (moveY / magnitude) * this.playerSpeed);
        }
    }

    // Handles the automatic weapon firing.
    handlePlayerShooting(time) {
        if (this.isUpgradeMenuOpen || this.gameOver) return; // Don't shoot if the game is paused.

        // Check if the cooldown period has passed.
        if (time > this.lastFired + this.fireCooldown) {
            // --- Find the Closest Enemy ---
            let closestEnemy = null;
            let minDist = Infinity;
            this.enemies.children.each(enemy => {
                if (enemy.active) {
                    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
                    if (dist < minDist) {
                        minDist = dist;
                        closestEnemy = enemy;
                    }
                }
            });

            // If an enemy was found, fire at it.
            if (closestEnemy) {
                // Special firing logic for triangle shape or if the player has the "+1 Projectile" upgrade.
                if (this.playerShape === 'triangle' || this.projectileCount > 1) {
                    // Special logic for the square shape.
                    if (this.playerShape === 'square') {
                        const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, closestEnemy.x, closestEnemy.y);
                        // Fire two projectiles: one towards the enemy, one directly away.
                        const angles = [angleToEnemy, angleToEnemy + Math.PI];
                        angles.forEach(angle => {
                            let projectile = this.projectiles.get(); // Get an inactive projectile from the group.
                            if (projectile) {
                                // Create the projectile texture if it doesn't exist yet.
                                if (!this.textures.exists('fireball')) {
                                    const graphics = this.add.graphics();
                                    graphics.fillStyle(0xffa500, 1);
                                    graphics.fillRect(0, 0, 10, 10);
                                    graphics.generateTexture('fireball', 10, 10);
                                    graphics.destroy();
                                }
                                projectile.setTexture('fireball');
                                projectile.setActive(true).setVisible(true);
                                projectile.setPosition(this.player.x, this.player.y);
                                this.physics.velocityFromRotation(angle, 500, projectile.body.velocity); // Set velocity based on angle.
                                projectile.setDepth(150);
                            }
                        });
                    } else { // Firing logic for triangle, circle, and upgraded default.
                        const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, closestEnemy.x, closestEnemy.y);
                        const spread = Phaser.Math.DegToRad(30); // The angle of the projectile spread.
                        const count = this.projectileCount; // The number of projectiles to fire.
                        for (let i = 0; i < count; i++) {
                            // Calculate the angle for each projectile to create a fan effect.
                            let angle = angleToEnemy + spread * (i - (count - 1) / 2) / (count > 1 ? (count - 1) : 1);
                            let projectile = this.projectiles.get();
                            if (projectile) {
                                // Create projectile texture if needed.
                                if (!this.textures.exists('fireball')) {
                                    const graphics = this.add.graphics();
                                    graphics.fillStyle(0xffa500, 1);
                                    graphics.fillRect(0, 0, 10, 10);
                                    graphics.generateTexture('fireball', 10, 10);
                                    graphics.destroy();
                                }
                                projectile.setTexture('fireball');
                                projectile.setActive(true).setVisible(true);
                                projectile.setPosition(this.player.x, this.player.y);
                                this.physics.velocityFromRotation(angle, 500, projectile.body.velocity);
                                projectile.setDepth(150);
                            }
                        }
                    }
                    this.lastFired = time; // Reset the fire timer.
                } else { // Default firing logic for a single projectile.
                    let projectile = this.projectiles.get();
                    if (projectile) {
                        if (!this.textures.exists('fireball')) {
                            const graphics = this.add.graphics();
                            graphics.fillStyle(0xffa500, 1);
                            graphics.fillRect(0, 0, 10, 10);
                            graphics.generateTexture('fireball', 10, 10);
                            graphics.destroy();
                        }
                        projectile.setTexture('fireball');
                        projectile.setActive(true).setVisible(true);
                        projectile.setPosition(this.player.x, this.player.y);
                        this.physics.moveTo(projectile, closestEnemy.x, closestEnemy.y, 500); // Move directly towards the enemy.
                        projectile.setDepth(150);
                        this.lastFired = time;
                    }
                }
            }
        }
    }

    // Updates all HUD elements.
    updateHUD(delta) {
        // --- Update Timer ---
        this.survivalTime += delta; // Add the time since the last frame to the total survival time.
        // Format the time into MM:SS format.
        const minutes = Math.floor(this.survivalTime / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((this.survivalTime % 60000) / 1000).toString().padStart(2, '0');
        this.timerText.setText(`Time: ${minutes}:${seconds}`);

        // --- Update Health Icons ---
        // If the player's max health has changed, recreate the health icons.
        if (this.healthIcons.length !== this.maxHealth) {
            this.healthIcons.forEach(heart => heart.destroy()); // Destroy old hearts.
            this.healthIcons = [];
            for (let i = 0; i < this.maxHealth; i++) {
                // Re-create the heart graphics.
                const heart = this.add.graphics();
                heart.fillStyle(0xff0000, 1);
                heart.fillTriangle(10, 0, 0, 10, 20, 10);
                heart.fillCircle(5, 10, 5);
                heart.fillCircle(15, 10, 5);
                heart.x = 20 + (i * 25);
                heart.y = 20;
                heart.setDepth(1000);
                this.healthIcons.push(heart);
            }
        }

        // --- Update Health Visibility ---
        // Show hearts for current health, hide them for lost health.
        for (let i = 0; i < this.maxHealth; i++) {
            this.healthIcons[i].setVisible(i < this.playerHealth);
        }

        // --- Update Player Level & EXP ---
        this.levelText.setText(`Lv. ${this.playerLevel}`);
        this.expText.setText(`EXP: ${this.orbCount}/${this.orbsToLevel}`);

        // --- Update Weapon Cooldown Bar ---
        if (this.cooldownBarFill) {
            const now = this.time.now;
            let progress = 1; // Default to 1 (100% full).
            // If the weapon is on cooldown, calculate the progress.
            if (now < this.lastFired + this.fireCooldown) {
                progress = (now - this.lastFired) / this.fireCooldown;
                progress = Phaser.Math.Clamp(progress, 0, 1); // Ensure progress is between 0 and 1.
            }
            this.cooldownBarFill.width = 400 * progress; // Set the width of the fill bar based on progress.
            // Change color to green when ready to fire, red when cooling down.
            this.cooldownBarFill.setFillStyle(progress >= 1 ? 0x00ff66 : 0xff4444, 1);
        }
    }

    // --- System Logic ---

    // Spawns a new enemy.
    spawnEnemy(forceType) {
        const enemy = this.enemies.get(); // Get an inactive enemy from the group.
        if (enemy) {
            let type;
            // If a specific type is requested (like 'red'), find it.
            if (forceType) {
                type = this.enemyTypes.find(t => t.key === forceType);
            } else {
                // Otherwise, pick a random enemy type.
                type = Phaser.Utils.Array.GetRandom(this.enemyTypes);
            }

            // Create the enemy's texture if it doesn't exist yet.
            const texKey = `enemyRect_${type.key}`;
            if (!this.textures.exists(texKey)) {
                const graphics = this.add.graphics();
                graphics.fillStyle(type.color, 1);
                graphics.fillRect(0, 0, 30, 30);
                graphics.generateTexture(texKey, 30, 30);
                graphics.destroy();
            }
            enemy.setTexture(texKey);
            enemy.setActive(true).setVisible(true);
            enemy.enemyType = type.key;
            enemy.behavior = type.behavior;
            enemy.spawnTime = this.time.now;

            // --- Spawn Position ---
            // Spawn the enemy just outside one of the four screen edges.
            const edge = Phaser.Math.Between(0, 3);
            const width = this.sys.game.config.width;
            const height = this.sys.game.config.height;
            let x, y;
            switch (edge) {
                case 0: x = Phaser.Math.Between(-50, width + 50); y = -50; break; // Top
                case 1: x = width + 50; y = Phaser.Math.Between(-50, height + 50); break; // Right
                case 2: x = Phaser.Math.Between(-50, width + 50); y = height + 50; break; // Bottom
                case 3: x = -50; y = Phaser.Math.Between(-50, height + 50); break; // Left
            }
            enemy.setPosition(x, y);
            enemy.baseX = x; // Store initial position for some behaviors.
            enemy.baseY = y;

            // --- Behavior-based Movement ---
            switch (type.behavior) {
                case 'track':
                    enemy.body.setVelocity(0, 0);
                    enemy.oscPhase = Phaser.Math.FloatBetween(0, Math.PI * 2); // Random phase for oscillation.
                    enemy.moveSpeed = Phaser.Math.Between(30, 120); // Random speed.
                    break;
                case 'straight': {
                    const playerPos = this.getPlayerPosition();
                    const playerVel = this.player.body.velocity;
                    // Predict the player's future position to lead the shot.
                    const predictX = playerPos.x + playerVel.x * 0.6;
                    const predictY = playerPos.y + playerVel.y * 0.6;
                    const angle = Phaser.Math.Angle.Between(x, y, predictX, predictY);
                    enemy.straightAngle = angle;
                    enemy.moveSpeed = Phaser.Math.Between(80, 200);
                    this.physics.velocityFromRotation(angle, enemy.moveSpeed, enemy.body.velocity);
                    enemy.straightStart = { x, y };
                    enemy.straightTime = 0;
                    break;
                }
                case 'diagonal':
                    const dx = Phaser.Math.Between(0, 1) ? 1 : -1; // Random horizontal direction.
                    const dy = Phaser.Math.Between(0, 1) ? 1 : -1; // Random vertical direction.
                    enemy.moveSpeed = Phaser.Math.Between(60, 250);
                    enemy.body.setVelocity(enemy.moveSpeed * dx, enemy.moveSpeed * dy);
                    enemy.diagonalDir = { x: dx, y: dy };
                    break;
                case 'sinusoidal':
                    enemy.sinDir = Phaser.Math.Between(0, 1) ? 'h' : 'v'; // Horizontal or vertical wave.
                    enemy.sinStart = this.time.now;
                    enemy.amp = Phaser.Math.Between(50, 150); // Wave amplitude.
                    enemy.freq = Phaser.Math.FloatBetween(2, 6); // Wave frequency.
                    enemy.baseX = x;
                    enemy.baseY = y;
                    enemy.moveSpeed = Phaser.Math.Between(50, 200);
                    enemy.body.setVelocity(0, 0); // Velocity is handled in preUpdate.
                    break;
            }

            enemy.setDepth(150); // Ensure enemies are below the player and HUD.
        }
    }

    // Called when a projectile hits an enemy.
    projectileHitEnemy(projectile, enemy) {
        projectile.setActive(false).setVisible(false); // Deactivate the projectile.
        const ex = enemy.x; // Save the enemy's position.
        const ey = enemy.y;
        enemy.setActive(false).setVisible(false); // Deactivate the enemy.

        // --- Spawn Experience Orb ---
        const orb = this.orbs.create(ex, ey, null);
        // Create the orb texture if it doesn't exist.
        if (!this.textures.exists('expOrbBlue')) {
            const g = this.add.graphics();
            g.fillStyle(0x3399ff, 1);
            g.fillCircle(12, 12, 12);
            g.generateTexture('expOrbBlue', 24, 24);
            g.destroy();
        }
        orb.setTexture('expOrbBlue');
        orb.setDisplaySize(24, 24);
        orb.body && (orb.body.setAllowGravity(false));
        orb.setCircle(12);
        orb.setOrigin(0.5);
        orb.setActive(true).setVisible(true);
        orb.body && orb.body.setVelocity(0, 0);
        orb.setDepth(120);

        // Automatically destroy the orb after 5 seconds if not collected.
        this.time.delayedCall(5000, () => {
            if (orb && orb.active) orb.destroy();
        });
    }

    // Called when the player touches an enemy.
    playerHitEnemy(player, enemy) {
        if (this.isPlayerInvincible) {
            return; // Do nothing if the player is invincible.
        }

        this.playerHealth--; // Reduce player health.

        enemy.setActive(false).setVisible(false); // Deactivate the enemy.
        enemy.destroy(); // Permanently remove the enemy.

        // --- Game Over Check ---
        if (this.playerHealth <= 0) {
            this.gameOver = true;
            this.physics.world.pause(); // Stop all physics.
            if (this.player.body) this.player.body.setVelocity(0, 0);
            this.showGameOverScreen(); // Show the game over screen.
            return;
        }

        // --- Grant Invincibility ---
        this.isPlayerInvincible = true;
        // Create a blinking effect to show invincibility.
        this.tweens.add({
            targets: this.player,
            alpha: 0.5,
            duration: 150,
            ease: 'Linear',
            yoyo: true, // Go back and forth between alpha 1.0 and 0.5.
            repeat: 4, // Repeat the blink several times.
            onComplete: () => {
                this.player.setAlpha(1.0); // Ensure player is fully visible at the end.
                this.isPlayerInvincible = false; // End invincibility.
            }
        });
    }

    // Spawns a simple orb (not currently used in the main gameplay loop).
    spawnSimpleOrb(x, y) {
        const orb = this.orbs.create(x, y, null);
        if (!this.textures.exists('simpleOrb')) {
            const graphics = this.add.graphics();
            graphics.fillStyle(0x3399ff, 1);
            graphics.fillCircle(12, 12, 12);
            graphics.generateTexture('simpleOrb', 24, 24);
            graphics.destroy();
        }
        orb.setTexture('simpleOrb');
        orb.setDisplaySize(24, 24);
        orb.setCircle(12);
        orb.setOrigin(0.5);
        orb.setActive(true).setVisible(true);
        orb.body && orb.body.setVelocity(0, 0);
        orb.setDepth(120);

        this.time.delayedCall(5000, () => {
            if (orb && orb.active) orb.destroy();
        });
    }

    // Called when the player collects an orb.
    collectOrb(player, orb) {
        if (!orb || !orb.active) return; // Make sure the orb is valid.
        orb.destroy(); // Destroy the orb sprite.
        this.orbCount++; // Increment the player's orb/XP count.

        // --- Level Up Check ---
        if (this.orbCount >= this.orbsToLevel) {
            this.orbCount = 0; // Reset orb count.
            this.playerLevel++; // Increase player level.
            // Restore 1 health point on level up, up to the maximum.
            if (this.playerHealth < this.maxHealth) {
                this.playerHealth++;
            }
            this.openUpgradeMenu(); // Open the upgrade menu.
        }
    }

    // Opens the level-up upgrade menu.
    openUpgradeMenu() {
        if (this.isUpgradeMenuOpen || this.gameOver) return;
        this.isUpgradeMenuOpen = true;

        if (this.spawnTimer) this.spawnTimer.paused = true; // Pause enemy spawning.
        this.physics.world.pause(); // Pause all physics.

        if (this.player && this.player.body) this.player.body.setVelocity(0, 0); // Stop player movement.

        // Reset D-pad state on mobile.
        if (this.dpadButtons) {
            Object.keys(this.dpadButtons).forEach(k => this.dpadButtons[k] = false);
        }

        // Get the first 4 upgrade options from our list.
        const options = this.upgradeOptions.slice(0, 4);

        const width = this.sys.game.config.width;
        const height = this.sys.game.config.height;
        // Create a container for the menu UI.
        this.upgradeMenu = this.add.container(width / 2, height / 2);
        this.upgradeMenu.setDepth(2000); // Ensure it's on top of everything.

        const bg = this.add.rectangle(0, 0, 420, 320, 0x222244, 0.95).setStrokeStyle(4, 0xffff00);
        this.upgradeMenu.add(bg);

        const title = this.add.text(0, -120, 'Level Up! Choose an Upgrade:', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
        this.upgradeMenu.add(title);

        // --- Create Buttons ---
        options.forEach((opt, i) => {
            const y = -40 + i * 60; // Position each button below the previous one.
            const btn = this.add.rectangle(0, y, 360, 50, 0x4444aa, 0.95).setStrokeStyle(2, 0xffffff).setInteractive();
            const txt = this.add.text(0, y, opt.name, { fontSize: '20px', fill: '#ffff00' }).setOrigin(0.5);

            btn.on('pointerdown', () => this.selectUpgrade(opt)); // Set click handler.
            this.upgradeMenu.add(btn);
            this.upgradeMenu.add(txt);
        });

        // --- Keyboard Support ---
        // Allow selecting upgrades with number keys 1-4.
        this.input.keyboard.once('keydown-ONE', () => this.selectUpgrade(options[0]));
        this.input.keyboard.once('keydown-TWO', () => this.selectUpgrade(options[1]));
        this.input.keyboard.once('keydown-THREE', () => this.selectUpgrade(options[2]));
        this.input.keyboard.once('keydown-FOUR', () => this.selectUpgrade(options[3]));
    }

    // Called when an upgrade is selected.
    selectUpgrade(opt) {
        if (!this.isUpgradeMenuOpen || this.gameOver) return;

        opt.apply(); // Apply the selected upgrade's function.

        // Destroy the menu and resume the game.
        if (this.upgradeMenu) {
            this.upgradeMenu.destroy(true);
            this.upgradeMenu = null;
        }
        this.isUpgradeMenuOpen = false;

        this.physics.world.resume(); // Resume physics.
        if (this.spawnTimer) this.spawnTimer.paused = false; // Resume enemy spawning.

        if (this.player && this.player.body) this.player.body.setVelocity(0, 0); // Ensure player is stopped.
    }

    // Shows the Game Over screen.
    showGameOverScreen() {
        const width = this.sys.game.config.width;
        const height = this.sys.game.config.height;

        this.gameOverContainer = this.add.container(width / 2, height / 2);
        this.gameOverContainer.setDepth(3000); // Highest depth.

        const bg = this.add.rectangle(0, 0, 500, 300, 0x881111, 0.95).setStrokeStyle(6, 0xffff00);
        this.gameOverContainer.add(bg);

        const title = this.add.text(0, -70, 'GAME OVER', { fontSize: '48px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.gameOverContainer.add(title);

        // Display final stats.
        const stats = this.add.text(0, -10, `Survived: ${Math.floor(this.survivalTime / 60000)}:${Math.floor((this.survivalTime % 60000) / 1000).toString().padStart(2, '0')}\nLevel: ${this.playerLevel}`, { fontSize: '20px', fill: '#ffffff', align: 'center' }).setOrigin(0.5);
        this.gameOverContainer.add(stats);

        // --- Restart Button ---
        const restartBtn = this.add.rectangle(0, 90, 220, 50, 0x4444aa, 0.95).setInteractive().setStrokeStyle(2, 0xffffff);
        const restartTxt = this.add.text(0, 90, 'Play Again', { fontSize: '20px', fill: '#ffff00' }).setOrigin(0.5);
        restartBtn.on('pointerdown', () => {
            this.scene.restart(); // Restart the current scene from scratch.
        });
        this.gameOverContainer.add(restartBtn);
        this.gameOverContainer.add(restartTxt);
    }

    // Shows the Win screen.
    showWinScreen() {
        if (this.spawnTimer) this.spawnTimer.remove(); // Stop the spawn timer permanently.
        this.physics.world.pause();
        this.isUpgradeMenuOpen = true; // Use this flag to prevent other inputs.

        const width = this.sys.game.config.width;
        const height = this.sys.game.config.height;
        const winContainer = this.add.container(width / 2, height / 2);
        winContainer.setDepth(3000);

        const bg = this.add.rectangle(0, 0, 500, 300, 0x00aa00, 0.95).setStrokeStyle(6, 0xffff00);
        winContainer.add(bg);

        const winText = this.add.text(0, -50, 'YOU WIN!', { fontSize: '64px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
        winContainer.add(winText);

        const statsText = this.add.text(0, 20, `Survival Time: ${Math.floor(this.survivalTime / 60000)}:${Math.floor((this.survivalTime % 60000) / 1000).toString().padStart(2, '0')}\nLevel: ${this.playerLevel}`, { fontSize: '24px', fill: '#ffffff', align: 'center' }).setOrigin(0.5);
        winContainer.add(statsText);

        const restartBtn = this.add.rectangle(0, 100, 200, 50, 0x4444aa, 0.9).setStrokeStyle(2, 0xffffff).setInteractive();
        const restartText = this.add.text(0, 100, 'Play Again', { fontSize: '20px', fill: '#ffff00' }).setOrigin(0.5);
        restartBtn.on('pointerdown', () => this.scene.restart());
        winContainer.add(restartBtn);
        winContainer.add(restartText);
    }

    // Cleans up game objects that have moved far off-screen to improve performance.
    cleanupOutOfBounds() {
        const bounds = this.physics.world.bounds;
        const padding = 200; // Extra buffer space outside the screen.

        // Deactivate off-screen projectiles.
        this.projectiles.children.each(child => {
            if (child.active && (child.x < -padding || child.x > bounds.width + padding || child.y < -padding || child.y > bounds.height + padding)) {
                child.setActive(false).setVisible(false);
            }
        });

        // Deactivate off-screen orbs.
        this.orbs.children.each(child => {
            if (child.active && (child.x < -padding || child.x > bounds.width + padding || child.y < -padding || child.y > bounds.height + padding)) {
                child.setActive(false).setVisible(false);
            }
        });
    }

    // A utility function to get the player's current position.
    getPlayerPosition() {
        return { x: this.player.x, y: this.player.y };
    }

    // --- Enemy Movement Update ---
    // preUpdate is a scene-level method called before the main update loop.
    // We use it here to handle complex enemy movements that need to be calculated every frame.
    preUpdate(time, delta) {
        // Call the parent's preUpdate if it exists.
        if (super.preUpdate) {
            super.preUpdate(time, delta);
        }

        // --- Failsafe: Ensure at least one red enemy is always present ---
        let redCount = 0;
        this.enemies.children.each(enemy => {
            if (!enemy.active) return;
            if (enemy.behavior === 'track') redCount++;
        });
        if (redCount === 0) {
            this.spawnEnemy('red'); // If no red enemies are left, spawn one.
        }

        // --- Update Enemy Movement Based on Behavior ---
        this.enemies.children.each(enemy => {
            if (!enemy.active) return;
            switch (enemy.behavior) {
                case 'track': {
                    const playerPos = this.getPlayerPosition();
                    const t = (time - enemy.spawnTime) / 1000;
                    // Move towards the player but with a slight sine wave oscillation for less predictable movement.
                    const baseAngle = Phaser.Math.Angle.Between(enemy.x, enemy.y, playerPos.x, playerPos.y);
                    const osc = Math.sin(t * 2 + (enemy.oscPhase || 0)) * Phaser.Math.DegToRad(30);
                    const angle = baseAngle + osc;
                    this.physics.velocityFromRotation(angle, enemy.moveSpeed || 60, enemy.body.velocity);
                    break;
                }
                case 'straight': {
                    // This behavior's velocity is set once at spawn, so no update needed here.
                    // This logic is an alternative way to move without physics velocity.
                    if (!enemy.straightStart) break;
                    enemy.straightTime = (time - enemy.spawnTime) / 1000;
                    const dist = (enemy.moveSpeed || 140) * enemy.straightTime;
                    enemy.x = enemy.straightStart.x + Math.cos(enemy.straightAngle) * dist;
                    enemy.y = enemy.straightStart.y + Math.sin(enemy.straightAngle) * dist;
                    break;
                }
                case 'diagonal': {
                    // If the enemy hits a horizontal or vertical edge of the screen, reverse its direction.
                    if (enemy.x < 0 || enemy.x > this.sys.game.config.width) {
                        enemy.body.velocity.x *= -1;
                        enemy.diagonalDir.x *= -1;
                    }
                    if (enemy.y < 0 || enemy.y > this.sys.game.config.height) {
                        enemy.body.velocity.y *= -1;
                        enemy.diagonalDir.y *= -1;
                    }
                    break;
                }
                case 'sinusoidal': {
                    // Move the enemy in a straight line on one axis and apply a sine wave motion on the other.
                    const t = (time - enemy.spawnTime) / 1000;
                    const speed = enemy.moveSpeed || 120;
                    if (enemy.sinDir === 'h') { // Horizontal main movement
                        enemy.x = enemy.baseX + speed * t;
                        enemy.y = enemy.baseY + enemy.amp * Math.sin(enemy.freq * t);
                    } else { // Vertical main movement
                        enemy.y = enemy.baseY + speed * t;
                        enemy.x = enemy.baseX + enemy.amp * Math.sin(enemy.freq * t);
                    }
                    break;
                }
            }
        });
    }
}

// Defines a custom Orb class that extends Phaser's Sprite class.
// This isn't strictly necessary as we are creating generic sprites, but it's good practice for custom objects.
class Orb extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'xpOrb');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setActive(false);
        this.setVisible(false);
        this.setDepth(100);
    }
}
