class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // Player properties
        this.player = null;
        this.playerSpeed = 200;
        this.playerHealth = 5;
        this.maxHealth = 5;
        this.isPlayerInvincible = false;

        // Input properties
        this.cursors = null;
        this.keys = null;

        // Weapon properties
        this.projectiles = null;
        this.fireCooldown = 3000;
        this.lastFired = 0;

        // Enemy properties
        this.enemies = null;

        // HUD properties
        this.healthIcons = [];
        this.timerText = null;
        this.survivalTime = 0;

        // Experience/Leveling properties
        this.orbs = null;
        this.orbCount = 0;
        this.playerLevel = 1;
        this.orbsToLevel = 10;
        this.levelText = null;
        this.playerExp = 0;
        this.expText = null;

        // Enemy type definitions
        this.enemyTypes = [
            { key: 'red', color: 0xff0000, behavior: 'track' },
            { key: 'blue', color: 0x3399ff, behavior: 'straight' },
            { key: 'green', color: 0x33ff33, behavior: 'diagonal' },
            { key: 'yellow', color: 0xffff33, behavior: 'sinusoidal' }
        ];
        this.upgradeMenu = null;
        // Keep upgradeOptions always in the same order (do not shuffle)
        this.upgradeOptions = [
            { name: '+1 Max Health', apply: () => { this.maxHealth++; /* DO NOT restore health */ } },
            { name: '+15% Speed', apply: () => { this.playerSpeed = Math.round(this.playerSpeed * 1.15); } },
            { name: '-20% Cooldown', apply: () => { this.fireCooldown = Math.max(200, Math.round(this.fireCooldown * 0.8)); } },
            { name: '+1 Projectile', apply: () => { this.projectileCount++; } }
        ];
        this.isUpgradeMenuOpen = false;
        this.playerShape = 'circle';
        this.projectileCount = 1;
        this.cooldownBarBg = null;
        this.cooldownBarFill = null;
        this.cooldownLabel = null;
        this.gameWon = false;
        this.winTime = 200000;
        this.dpad = null;
        this.isMobile = false;

        // Game Over state
        this.gameOver = false;
        this.gameOverContainer = null;
    }

    init(data) {
        if (data && data.playerShape) {
            this.playerShape = data.playerShape;
        }
        if (this.playerShape === 'circle') {
            this.fireCooldown = 2000;
            this.projectileCount = 1;
        } else if (this.playerShape === 'triangle') {
            this.fireCooldown = 5000;
            this.projectileCount = 3;
        } else if (this.playerShape === 'square') {
            this.fireCooldown = 3000;
            this.projectileCount = 2;
        }
    }

    create() {
        // --- Player Setup ---
        this.player = this.physics.add.sprite(this.sys.game.config.width / 2, this.sys.game.config.height / 2, null);
        this.player.body.setCircle(16);
        this.player.setCollideWorldBounds(true);
        this.createPlayerTexture();

        // --- Input Setup ---
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys('W,A,S,D');

        // Check if mobile and create D-pad
        this.isMobile = this.sys.game.config.width < 768;
        if (this.isMobile) {
            this.createDPad();
        }

        // --- HUD Setup ---
        this.createHUD();

        // --- Weapon System Setup ---
        this.projectiles = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            runChildUpdate: true
        });

        // --- Enemy System Setup ---
        this.enemies = this.physics.add.group({
            runChildUpdate: true,
            classType: Phaser.Physics.Arcade.Sprite
        });

        // --- Orbs Group ---
        this.orbs = this.physics.add.group();

        // --- Enemy Spawn Timer ---
        this.baseSpawnDelay = 100;
        this.currentSpawnDelay = this.baseSpawnDelay;
        this.lastSpawnAdjust = 0;
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        // Spawn some starting enemies
        for (let i = 1; i < 9; i++) {
            this.spawnEnemy('red');
        }

        // --- Collision Setup ---
        this.physics.add.collider(this.projectiles, this.enemies, this.projectileHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);
        this.physics.add.overlap(this.player, this.orbs, this.collectOrb, null, this);

        // Ensure HUD stays above everything (depth already set in createHUD, but set world default lower)
        this.children.list.forEach(child => {
            // don't change HUD depths here; we set orb/enemy/player depths explicitly when creating them
        });

        // Reset states if restarting scene
        this.gameOver = false;
        this.isUpgradeMenuOpen = false;
    }

    update(time, delta) {
        if (this.isUpgradeMenuOpen || this.gameOver) {
            // Only update HUD when menu is open or game is over
            this.updateHUD(delta);
            return;
        }

        // Check for win condition
        if (!this.gameWon && this.survivalTime >= this.winTime) {
            this.gameWon = true;
            this.showWinScreen();
            return;
        }

        // Dynamic spawn rate scaling
        const elapsedSec = Math.floor(this.survivalTime / 1000);
        if (elapsedSec - this.lastSpawnAdjust >= 10) {
            this.lastSpawnAdjust = elapsedSec;
            this.currentSpawnDelay *= 0.80;
            this.spawnTimer.reset({ delay: this.currentSpawnDelay, callback: this.spawnEnemy, callbackScope: this, loop: true });
        }

        this.handlePlayerMovement();
        this.handlePlayerShooting(time);
        this.updateHUD(delta);
        this.cleanupOutOfBounds();
    }

    // --- Creation Helpers ---

    createPlayerTexture() {
        const graphics = this.add.graphics();
        if (this.playerShape === 'circle') {
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(16, 16, 16);
            graphics.generateTexture('playerCircle', 32, 32);
            this.player.setTexture('playerCircle');
        } else if (this.playerShape === 'triangle') {
            graphics.fillStyle(0x00ffcc, 1);
            graphics.fillTriangle(4, 28, 16, 0, 28, 28);
            graphics.generateTexture('playerTriangle', 32, 32);
            this.player.setTexture('playerTriangle');
        } else if (this.playerShape === 'square') {
            graphics.fillStyle(0xffa500, 1);
            graphics.fillRect(0, 0, 32, 32);
            graphics.generateTexture('playerSquare', 32, 32);
            this.player.setTexture('playerSquare');
        }
        graphics.destroy();

        // Player above normal entities but below HUD
        this.player.setDepth(200);
    }

    createHUD() {
        // Health display (Hearts)
        this.healthIcons = [];
        for (let i = 0; i < this.maxHealth; i++) {
            const heart = this.add.graphics();
            heart.fillStyle(0xff0000, 1); // Red heart
            heart.fillTriangle(10, 0, 0, 10, 20, 10);
            heart.fillCircle(5, 10, 5);
            heart.fillCircle(15, 10, 5);
            heart.x = 20 + (i * 25);
            heart.y = 20;
            heart.setDepth(1000); // HUD depth (on top)
            this.healthIcons.push(heart);
        }

        // Survival Timer
        this.timerText = this.add.text(this.sys.game.config.width / 2, 20, 'Time: 00:00', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5, 0);
        this.timerText.setDepth(1000);

        // Player Level display (upper right)
        this.levelText = this.add.text(this.sys.game.config.width - 30, 20, `Lv. ${this.playerLevel}`, {
            fontSize: '24px',
            fill: '#ffff00',
            align: 'right'
        }).setOrigin(1, 0);
        this.levelText.setDepth(1000);

        // Player Experience display (upper right, below level)
        this.expText = this.add.text(this.sys.game.config.width - 30, 50, `EXP: ${this.orbCount}/10`, {
            fontSize: '20px',
            fill: '#00ccff',
            align: 'right'
        }).setOrigin(1, 0);
        this.expText.setDepth(1000);

        // Weapon Cooldown Progress Bar (bottom center)
        const barWidth = 200;
        const barHeight = 18;
        const barY = this.sys.game.config.height - 40;
        const barX = this.sys.game.config.width / 2 - barWidth / 2;
        this.cooldownBarBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0x222222, 0.7).setOrigin(0, 0.5);
        this.cooldownBarBg.setDepth(1000);
        this.cooldownBarFill = this.add.rectangle(barX, barY, 0, barHeight, 0x00ff66, 1).setOrigin(0, 0.5);
        this.cooldownBarFill.setDepth(1000);
        this.cooldownLabel = this.add.text(this.sys.game.config.width / 2, barY - 18, 'Weapon Cooldown', { fontSize: '16px', fill: '#fff' }).setOrigin(0.5, 1);
        this.cooldownLabel.setDepth(1000);
    }

    createDPad() {
        const dpadSize = 120;
        const dpadX = 80;
        const dpadY = this.sys.game.config.height - 80;

        this.dpad = this.add.container(dpadX, dpadY);

        // D-pad background
        const bg = this.add.circle(0, 0, dpadSize / 2, 0x333333, 0.7);
        this.dpad.add(bg);

        // Directional buttons
        const directions = [
            { key: 'up', x: 0, y: -40, angle: -90 },
            { key: 'down', x: 0, y: 40, angle: 90 },
            { key: 'left', x: -40, y: 0, angle: 180 },
            { key: 'right', x: 40, y: 0, angle: 0 }
        ];

        this.dpadButtons = {};
        directions.forEach(dir => {
            const btn = this.add.circle(dir.x, dir.y, 25, 0x666666, 0.8)
                .setInteractive()
                .on('pointerdown', () => this.dpadButtons[dir.key] = true)
                .on('pointerup', () => this.dpadButtons[dir.key] = false)
                .on('pointerout', () => this.dpadButtons[dir.key] = false);
            this.dpad.add(btn);
            this.dpadButtons[dir.key] = false;
        });

        this.dpad.setDepth(500); // below HUD
    }

    // --- Update Handlers ---

    handlePlayerMovement() {
        // Don't apply movement when menu or game over
        if (this.isUpgradeMenuOpen || this.gameOver) {
            if (this.player && this.player.body) this.player.body.setVelocity(0, 0);
            return;
        }

        // Reset velocity each frame, then apply input
        this.player.body.setVelocity(0);
        let moveX = 0;
        let moveY = 0;

        if (this.isMobile) {
            if (this.dpadButtons.up) moveY = -1;
            if (this.dpadButtons.down) moveY = 1;
            if (this.dpadButtons.left) moveX = -1;
            if (this.dpadButtons.right) moveX = 1;
        } else {
            if (this.keys.A.isDown || this.cursors.left.isDown) moveX = -1;
            else if (this.keys.D.isDown || this.cursors.right.isDown) moveX = 1;
            if (this.keys.W.isDown || this.cursors.up.isDown) moveY = -1;
            else if (this.keys.S.isDown || this.cursors.down.isDown) moveY = 1;
        }

        const magnitude = Math.sqrt(moveX * moveX + moveY * moveY);
        if (magnitude > 0) {
            this.player.body.setVelocity((moveX / magnitude) * this.playerSpeed, (moveY / magnitude) * this.playerSpeed);
        }
    }

    handlePlayerShooting(time) {
        if (this.isUpgradeMenuOpen || this.gameOver) return;

        if (time > this.lastFired + this.fireCooldown) {
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
            if (closestEnemy) {
                if (this.playerShape === 'triangle' || this.projectileCount > 1) {
                    if (this.playerShape === 'square') {
                        const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, closestEnemy.x, closestEnemy.y);
                        const angles = [angleToEnemy, angleToEnemy + Math.PI];
                        angles.forEach(angle => {
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
                                projectile.body && this.physics.velocityFromRotation(angle, 500, projectile.body.velocity);
                                projectile.setDepth(150); // below HUD
                            }
                        });
                    } else {
                        const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, closestEnemy.x, closestEnemy.y);
                        const spread = Phaser.Math.DegToRad(30);
                        const count = this.projectileCount;
                        for (let i = 0; i < count; i++) {
                            let angle = angleToEnemy + spread * (i - (count - 1) / 2) / (count > 1 ? (count - 1) : 1);
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
                                projectile.body && this.physics.velocityFromRotation(angle, 500, projectile.body.velocity);
                                projectile.setDepth(150);
                            }
                        }
                    }
                    this.lastFired = time;
                } else {
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
                        this.physics.moveTo(projectile, closestEnemy.x, closestEnemy.y, 500);
                        projectile.setDepth(150);
                        this.lastFired = time;
                    }
                }
            }
        }
    }

    updateHUD(delta) {
        // Update timer
        this.survivalTime += delta;
        const minutes = Math.floor(this.survivalTime / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((this.survivalTime % 60000) / 1000).toString().padStart(2, '0');
        this.timerText.setText(`Time: ${minutes}:${seconds}`);

        // Update health icons - recreate if maxHealth changed
        if (this.healthIcons.length !== this.maxHealth) {
            this.healthIcons.forEach(heart => heart.destroy());
            this.healthIcons = [];
            for (let i = 0; i < this.maxHealth; i++) {
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

        // Update health visibility
        for (let i = 0; i < this.maxHealth; i++) {
            this.healthIcons[i].setVisible(i < this.playerHealth);
        }

        // Update player level & exp
        this.levelText.setText(`Lv. ${this.playerLevel}`);
        this.expText.setText(`EXP: ${this.orbCount}/${this.orbsToLevel}`);

        // Update weapon cooldown bar
        if (this.cooldownBarFill) {
            const now = this.time.now;
            let progress = 1;
            if (now < this.lastFired + this.fireCooldown) {
                progress = (now - this.lastFired) / this.fireCooldown;
                progress = Phaser.Math.Clamp(progress, 0, 1);
            }
            this.cooldownBarFill.width = 200 * progress;
            this.cooldownBarFill.setFillStyle(progress >= 1 ? 0x00ff66 : 0xff4444, 1);
        }
    }

    // --- System Logic ---

    spawnEnemy(forceType) {
        const enemy = this.enemies.get();
        if (enemy) {
            let type;
            if (forceType) {
                type = this.enemyTypes.find(t => t.key === forceType);
            } else {
                type = Phaser.Utils.Array.GetRandom(this.enemyTypes);
            }

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

            // Spawn outside screen edges
            const edge = Phaser.Math.Between(0, 3);
            const width = this.sys.game.config.width;
            const height = this.sys.game.config.height;
            let x, y;
            switch (edge) {
                case 0: x = Phaser.Math.Between(-50, width + 50); y = -50; break;
                case 1: x = width + 50; y = Phaser.Math.Between(-50, height + 50); break;
                case 2: x = Phaser.Math.Between(-50, width + 50); y = height + 50; break;
                case 3: x = -50; y = Phaser.Math.Between(-50, height + 50); break;
            }
            enemy.setPosition(x, y);
            enemy.baseX = x;
            enemy.baseY = y;

            // Behaviour movement
            switch (type.behavior) {
                case 'track':
                    enemy.body.setVelocity(0, 0);
                    enemy.oscPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
                    enemy.moveSpeed = Phaser.Math.Between(30, 120);
                    break;
                case 'straight': {
                    const playerPos = this.getPlayerPosition();
                    const playerVel = this.player.body.velocity;
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
                    const dx = Phaser.Math.Between(0, 1) ? 1 : -1;
                    const dy = Phaser.Math.Between(0, 1) ? 1 : -1;
                    enemy.moveSpeed = Phaser.Math.Between(60, 250);
                    enemy.body.setVelocity(enemy.moveSpeed * dx, enemy.moveSpeed * dy);
                    enemy.diagonalDir = { x: dx, y: dy };
                    break;
                case 'sinusoidal':
                    enemy.sinDir = Phaser.Math.Between(0, 1) ? 'h' : 'v';
                    enemy.sinStart = this.time.now;
                    enemy.amp = Phaser.Math.Between(50, 150);
                    enemy.freq = Phaser.Math.FloatBetween(2, 6);
                    enemy.baseX = x;
                    enemy.baseY = y;
                    enemy.moveSpeed = Phaser.Math.Between(50, 200);
                    enemy.body.setVelocity(0, 0);
                    break;
            }

            // ensure enemies are under HUD
            enemy.setDepth(150);
        }
    }

    projectileHitEnemy(projectile, enemy) {
        projectile.setActive(false).setVisible(false);
        // Save enemy pos
        const ex = enemy.x;
        const ey = enemy.y;
        enemy.setActive(false).setVisible(false);

        // Create buttons in fixed order
        options.forEach((opt, i) => {
            const y = -40 + i * 60;
            const btn = this.add.rectangle(0, y, 360, 50, 0x4444aa, 0.95).setStrokeStyle(2, 0xffffff).setInteractive();
            btn.setDepth(2000);
            const txt = this.add.text(0, y, opt.name, { fontSize: '20px', fill: '#ffff00' }).setOrigin(0.5);
            txt.setDepth(2000);

            btn.on('pointerdown', () => this.selectUpgrade(opt));
            this.upgradeMenu.add(btn);
            this.upgradeMenu.add(txt);
        });

        // Keyboard support (1-4)
        this.input.keyboard.once('keydown-ONE', () => this.selectUpgrade(options[0]));
        this.input.keyboard.once('keydown-TWO', () => this.selectUpgrade(options[1]));
        this.input.keyboard.once('keydown-THREE', () => this.selectUpgrade(options[2]));
        this.input.keyboard.once('keydown-FOUR', () => this.selectUpgrade(options[3]));
    }

    selectUpgrade(opt) {
        if (!this.isUpgradeMenuOpen || this.gameOver) return;

        // Apply the upgrade (note: upgrades should not auto-heal the player)
        opt.apply();

        // Destroy menu and resume game systems
        if (this.upgradeMenu) {
            this.upgradeMenu.destroy(true);
            this.upgradeMenu = null;
        }
        this.isUpgradeMenuOpen = false;

        // Resume world and spawn timer
        this.physics.world.resume();
        if (this.spawnTimer) this.spawnTimer.paused = false;

        // Ensure player isn't stuck moving
        if (this.player && this.player.body) this.player.body.setVelocity(0, 0);
    }

    showGameOverScreen() {
        // Stop all game systems
        if (this.spawnTimer) {
            this.spawnTimer.paused = true;
        }
        this.physics.world.pause();
        
        // Stop player movement
        if (this.player && this.player.body) {
            this.player.body.setVelocity(0, 0);
        }

        // Create a top layer container for game over UI
        const width = this.sys.game.config.width;
        const height = this.sys.game.config.height;

        this.gameOverContainer = this.add.container(width / 2, height / 2);
        this.gameOverContainer.setDepth(3000);

        const bg = this.add.rectangle(0, 0, 500, 300, 0x881111, 0.95).setStrokeStyle(6, 0xffff00);
        this.gameOverContainer.add(bg);

        const title = this.add.text(0, -70, 'GAME OVER', { fontSize: '48px', fill: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        this.gameOverContainer.add(title);

        const minutes = Math.floor(this.survivalTime / 60000);
        const seconds = Math.floor((this.survivalTime % 60000) / 1000);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const stats = this.add.text(0, -10, `Survived: ${timeStr}\nLevel: ${this.playerLevel}`, { 
            fontSize: '20px', 
            fill: '#ffffff', 
            align: 'center' 
        }).setOrigin(0.5);
        this.gameOverContainer.add(stats);

        const restartBtn = this.add.rectangle(0, 90, 220, 50, 0x4444aa, 0.95).setInteractive().setStrokeStyle(2, 0xffffff);
        const restartTxt = this.add.text(0, 90, 'Play Again', { fontSize: '20px', fill: '#ffff00' }).setOrigin(0.5);
        
        restartBtn.on('pointerdown', () => {
            // Restart the scene to reset everything
            this.scene.restart();
        });
        
        this.gameOverContainer.add(restartBtn);
        this.gameOverContainer.add(restartTxt);

        // Keyboard support for restart
        this.input.keyboard.once('keydown-SPACE', () => {
            this.scene.restart();
        });
        this.input.keyboard.once('keydown-ENTER', () => {
            this.scene.restart();
        });
    }

    showWinScreen() {
        // Stop spawn timer and pause world
        if (this.spawnTimer) this.spawnTimer.remove();
        this.physics.world.pause();
        this.isUpgradeMenuOpen = true; // prevent further gameplay

        const width = this.sys.game.config.width;
        const height = this.sys.game.config.height;
        const winContainer = this.add.container(width / 2, height / 2);
        winContainer.setDepth(3000);

        const bg = this.add.rectangle(0, 0, 500, 300, 0x00aa00, 0.95).setStrokeStyle(6, 0xffff00);
        winContainer.add(bg);

        const winText = this.add.text(0, -50, 'YOU WIN!', { fontSize: '64px', fill: '#ffff00', fontStyle: 'bold' }).setOrigin(0.5);
        winContainer.add(winText);

        const minutes = Math.floor(this.survivalTime / 60000);
        const seconds = Math.floor((this.survivalTime % 60000) / 1000);
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const statsText = this.add.text(0, 20, `Survival Time: ${timeStr}\nLevel: ${this.playerLevel}`, { 
            fontSize: '24px', 
            fill: '#ffffff', 
            align: 'center' 
        }).setOrigin(0.5);
        winContainer.add(statsText);

        const restartBtn = this.add.rectangle(0, 100, 200, 50, 0x4444aa, 0.9).setStrokeStyle(2, 0xffffff).setInteractive();
        const restartText = this.add.text(0, 100, 'Play Again', { fontSize: '20px', fill: '#ffff00' }).setOrigin(0.5);
        restartBtn.on('pointerdown', () => this.scene.restart());
        winContainer.add(restartBtn);
        winContainer.add(restartText);
    }

    cleanupOutOfBounds() {
        const bounds = this.physics.world.bounds;
        const padding = 200; // Extra space outside the screen

        this.projectiles.children.each(child => {
            if (child.active && (child.x < -padding || child.x > bounds.width + padding || child.y < -padding || child.y > bounds.height + padding)) {
                child.setActive(false).setVisible(false);
            }
        });

        this.orbs.children.each(child => {
            if (child.active && (child.x < -padding || child.x > bounds.width + padding || child.y < -padding || child.y > bounds.height + padding)) {
                child.setActive(false).setVisible(false);
            }
        });
    }

    // --- Utility: Get Player Position ---
    getPlayerPosition() {
        return { x: this.player.x, y: this.player.y };
    }

    // --- Enemy Movement Update ---
    preUpdate(time, delta) {
        super.preUpdate && super.preUpdate(time, delta);

        // Don't update enemies if game is over
        if (this.gameOver) return;

        // Ensure at least one red (track) enemy is present
        let redCount = 0;
        this.enemies.children.each(enemy => {
            if (!enemy.active) return;
            if (enemy.behavior === 'track') redCount++;
        });
        if (redCount === 0) {
            this.spawnEnemy('red');
        }

        this.enemies.children.each(enemy => {
            if (!enemy.active) return;
            switch (enemy.behavior) {
                case 'track': {
                    const playerPos = this.getPlayerPosition();
                    const t = (time - enemy.spawnTime) / 1000;
                    const baseAngle = Phaser.Math.Angle.Between(enemy.x, enemy.y, playerPos.x, playerPos.y);
                    const osc = Math.sin(t * 2 + (enemy.oscPhase || 0)) * Phaser.Math.DegToRad(30);
                    const angle = baseAngle + osc;
                    this.physics.velocityFromRotation(angle, enemy.moveSpeed || 60, enemy.body.velocity);
                    break;
                }
                case 'straight': {
                    if (!enemy.straightStart) break;
                    enemy.straightTime = (time - enemy.spawnTime) / 1000;
                    const dist = (enemy.moveSpeed || 140) * enemy.straightTime;
                    enemy.x = enemy.straightStart.x + Math.cos(enemy.straightAngle) * dist;
                    enemy.y = enemy.straightStart.y + Math.sin(enemy.straightAngle) * dist;
                    break;
                }
                case 'diagonal': {
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
                    const t = (time - enemy.spawnTime) / 1000;
                    const speed = enemy.moveSpeed || 120;
                    if (enemy.sinDir === 'h') {
                        enemy.x = enemy.baseX + speed * t;
                        enemy.y = enemy.baseY + enemy.amp * Math.sin(enemy.freq * t);
                    } else {
                        enemy.y = enemy.baseY + speed * t;
                        enemy.x = enemy.baseX + enemy.amp * Math.sin(enemy.freq * t);
                    }
                    break;
                }
            }
        });
    }
}

// --- Orb Class ---
class Orb extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'xpOrb');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setActive(false);
        this.setVisible(false);
        this.setDepth(100); // default orb depth lower than HUD
    }
} orb at enemy pos
        const orb = this.orbs.create(ex, ey, null);
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
        orb.setDepth(120); // below HUD

        // Auto-destroy orb after 2 seconds if not collected
        this.time.delayedCall(2000, () => {
            if (orb && orb.active) {
                orb.destroy();
            }
        });
    }

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

        // Auto-destroy orb after 2 seconds if not collected
        this.time.delayedCall(2000, () => {
            if (orb && orb.active) {
                orb.destroy();
            }
        });
    }

    collectOrb(player, orb) {
        // immediate collection
        if (!orb || !orb.active) return;
        orb.destroy();
        this.orbCount++;
        if (this.orbCount >= this.orbsToLevel) {
            this.orbCount = 0;
            this.playerLevel++;
            // Open upgrade menu (do NOT restore health)
            this.openUpgradeMenu();
        }
    }

    // NEW: Player hit by enemy - damage and check game over
    playerHitEnemy(player, enemy) {
        if (this.isPlayerInvincible || this.gameOver) return;

        // Take damage
        this.playerHealth--;
        
        // Check for game over
        if (this.playerHealth <= 0) {
            this.gameOver = true;
            this.showGameOverScreen();
            return;
        }

        // Make player temporarily invincible
        this.isPlayerInvincible = true;
        
        // Visual feedback - make player flash
        this.tweens.add({
            targets: this.player,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 5,
            onComplete: () => {
                this.player.alpha = 1;
                this.isPlayerInvincible = false;
            }
        });
    }

    openUpgradeMenu() {
        if (this.isUpgradeMenuOpen || this.gameOver) return;
        this.isUpgradeMenuOpen = true;

        // Pause spawn timer, and pause physics for enemies/projectiles
        if (this.spawnTimer) this.spawnTimer.paused = true;
        this.physics.world.pause();

        // Stop player movement immediately
        if (this.player && this.player.body) this.player.body.setVelocity(0, 0);

        // If mobile, clear D-pad
        if (this.dpadButtons) {
            Object.keys(this.dpadButtons).forEach(k => this.dpadButtons[k] = false);
        }

        // Fixed order options (do not shuffle) - only show first 4 options
        const options = this.upgradeOptions.slice(0, 4);

        const width = this.sys.game.config.width;
        const height = this.sys.game.config.height;
        this.upgradeMenu = this.add.container(width / 2, height / 2);
        this.upgradeMenu.setDepth(2000); // topmost UI

        const bg = this.add.rectangle(0, 0, 420, 320, 0x222244, 0.95).setStrokeStyle(4, 0xffff00);
        this.upgradeMenu.add(bg);

        const title = this.add.text(0, -120, 'Level Up! Choose an Upgrade:', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
        title.setDepth(2000);
        this.upgradeMenu.add(title);

        // Create
