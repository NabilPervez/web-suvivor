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
        this.fireCooldown = 2000; // 2-second cooldown from PRD
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
        this.upgradeOptions = [
            { name: '+1 Max Health', apply: () => { this.maxHealth++; this.playerHealth = this.maxHealth; } },
            { name: '+15% Speed', apply: () => { this.playerSpeed = Math.round(this.playerSpeed * 1.15); } },
            { name: '-20% Cooldown', apply: () => { this.fireCooldown = Math.max(200, Math.round(this.fireCooldown * 0.8)); } },
            { name: '+1 Projectile', apply: () => { this.projectileCount++; } }
        ];
        this.isUpgradeMenuOpen = false;
        this.playerShape = 'circle'; // Default
        this.projectileCount = 1; // For upgrades and triangle
        this.cooldownBarBg = null;
        this.cooldownBarFill = null;
    }

    init(data) {
        if (data && data.playerShape) {
            this.playerShape = data.playerShape;
        }
        // Set weapon properties based on shape
        if (this.playerShape === 'circle') {
            this.fireCooldown = 2000;
            this.projectileCount = 1;
        } else if (this.playerShape === 'triangle') {
            this.fireCooldown = 5000;
            this.projectileCount = 3;
        } else if (this.playerShape === 'square') {
            this.fireCooldown = 3000;
            this.projectileCount = 1;
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

        // --- HUD Setup ---
        this.createHUD();

        // --- Weapon System Setup ---
        // Group to manage all projectiles
        this.projectiles = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite,
            runChildUpdate: true // Allows projectiles to update themselves
        });

        // --- Enemy System Setup ---
        // Group to manage all enemies
        this.enemies = this.physics.add.group({
            runChildUpdate: true,
            classType: Phaser.Physics.Arcade.Sprite
        });

        // --- Orbs Group ---
        this.orbs = this.physics.add.group();

        // --- Enemy Spawn Timer ---
        this.baseSpawnDelay = 150;
        this.currentSpawnDelay = this.baseSpawnDelay;
        this.lastSpawnAdjust = 0;
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });
        // Spawn multiple reds at the beginning
        for (let i = 0; i < 3; i++) {
            this.spawnEnemy('red');
        }
        
        // --- Collision Setup ---
        // When a projectile hits an enemy
        this.physics.add.collider(this.projectiles, this.enemies, this.projectileHitEnemy, null, this);
        // When the player hits an enemy
        this.physics.add.overlap(this.player, this.enemies, this.playerHitEnemy, null, this);
        // Player collects orbs
        this.physics.add.overlap(this.player, this.orbs, this.collectOrb, null, this);
    }
    
    update(time, delta) {
        if (this.isUpgradeMenuOpen) {
            this.updateHUD(delta);
            return;
        }
        // --- Dynamic spawn rate scaling ---
        // Every 30 seconds, increase spawn rate by 15%
        const elapsedSec = Math.floor(this.survivalTime / 1000);
        if (elapsedSec - this.lastSpawnAdjust >= 30) {
            this.lastSpawnAdjust = elapsedSec;
            // Decrease delay by 15%
            this.currentSpawnDelay *= 0.85;
            this.spawnTimer.reset({ delay: this.currentSpawnDelay, callback: this.spawnEnemy, callbackScope: this, loop: true });
        }
        this.handlePlayerMovement();
        this.handlePlayerShooting(time);
        this.updateHUD(delta);

        // Despawn objects that go too far off-screen
        this.cleanupOutOfBounds();
    }

    // --- Creation Helpers ---

    createPlayerTexture() {
        let graphics = this.add.graphics();
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
    }

    createHUD() {
        // Health display (Hearts)
        for (let i = 0; i < this.maxHealth; i++) {
            let heart = this.add.graphics();
            heart.fillStyle(0xff0000, 1); // Red heart
            heart.fillTriangle(10, 0, 0, 10, 20, 10);
            heart.fillCircle(5, 10, 5);
            heart.fillCircle(15, 10, 5);
            heart.x = 20 + (i * 25);
            heart.y = 20;
            this.healthIcons.push(heart);
        }

        // Survival Timer
        this.timerText = this.add.text(this.sys.game.config.width / 2, 20, 'Time: 00:00', {
            fontSize: '24px',
            fill: '#ffffff'
        }).setOrigin(0.5, 0);

        // Player Level display (upper right)
        this.levelText = this.add.text(this.sys.game.config.width - 30, 20, `Lv. ${this.playerLevel}`, {
            fontSize: '24px',
            fill: '#ffff00',
            align: 'right'
        }).setOrigin(1, 0);
        // Player Experience display (upper right, below level)
        this.expText = this.add.text(this.sys.game.config.width - 30, 50, `EXP: ${this.orbCount}/10`, {
            fontSize: '20px',
            fill: '#00ccff',
            align: 'right'
        }).setOrigin(1, 0);

        // Weapon Cooldown Progress Bar (bottom center)
        const barWidth = 200;
        const barHeight = 18;
        const barY = this.sys.game.config.height - 40;
        const barX = this.sys.game.config.width / 2 - barWidth / 2;
        this.cooldownBarBg = this.add.rectangle(barX, barY, barWidth, barHeight, 0x222222, 0.7).setOrigin(0, 0.5);
        this.cooldownBarFill = this.add.rectangle(barX, barY, 0, barHeight, 0x00ff66, 1).setOrigin(0, 0.5);
        this.add.text(this.sys.game.config.width / 2, barY - 18, 'Weapon Cooldown', { fontSize: '16px', fill: '#fff' }).setOrigin(0.5, 1);
    }

    // --- Update Handlers ---

    handlePlayerMovement() {
        this.player.body.setVelocity(0);
        let moveX = 0;
        let moveY = 0;

        if (this.keys.A.isDown || this.cursors.left.isDown) moveX = -1;
        else if (this.keys.D.isDown || this.cursors.right.isDown) moveX = 1;
        if (this.keys.W.isDown || this.cursors.up.isDown) moveY = -1;
        else if (this.keys.S.isDown || this.cursors.down.isDown) moveY = 1;
        
        const magnitude = Math.sqrt(moveX * moveX + moveY * moveY);
        if (magnitude > 0) {
            this.player.body.setVelocity((moveX / magnitude) * this.playerSpeed, (moveY / magnitude) * this.playerSpeed);
        }
    }

    handlePlayerShooting(time) {
        if (time > this.lastFired + this.fireCooldown) {
            // Find closest enemy
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
                    // Fire three projectiles in a spread
                    const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, closestEnemy.x, closestEnemy.y);
                    const spread = Phaser.Math.DegToRad(30); // 30 degree spread
                    const count = this.projectileCount;
                    for (let i = 0; i < count; i++) {
                        let angle = angleToEnemy + spread * (i - (count - 1) / 2) / (count > 1 ? (count - 1) : 1);
                        let projectile = this.projectiles.get();
                        if (projectile) {
                            if (!this.textures.exists('fireball')) {
                                let graphics = this.add.graphics();
                                graphics.fillStyle(0xffa500, 1);
                                graphics.fillRect(0, 0, 10, 10);
                                graphics.generateTexture('fireball', 10, 10);
                                graphics.destroy();
                            }
                            projectile.setTexture('fireball');
                            projectile.setActive(true).setVisible(true);
                            projectile.setPosition(this.player.x, this.player.y);
                            this.physics.velocityFromRotation(angle, 500, projectile.body.velocity);
                        }
                    }
                    this.lastFired = time;
                } else {
                    // Single projectile (circle, square)
                    let projectile = this.projectiles.get();
                    if (projectile) {
                        if (!this.textures.exists('fireball')) {
                            let graphics = this.add.graphics();
                            graphics.fillStyle(0xffa500, 1);
                            graphics.fillRect(0, 0, 10, 10);
                            graphics.generateTexture('fireball', 10, 10);
                            graphics.destroy();
                        }
                        projectile.setTexture('fireball');
                        projectile.setActive(true).setVisible(true);
                        projectile.setPosition(this.player.x, this.player.y);
                        this.physics.moveTo(projectile, closestEnemy.x, closestEnemy.y, 500);
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

        // Update health icons
        for (let i = 0; i < this.maxHealth; i++) {
            this.healthIcons[i].setVisible(i < this.playerHealth);
        }

        // Update player level
        this.levelText.setText(`Lv. ${this.playerLevel}`);
        // Update player experience
        this.expText.setText(`EXP: ${this.orbCount}/10`);

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
        let enemy = this.enemies.get();
        if (enemy) {
            // Randomly select enemy type, or force a type
            let type;
            if (forceType) {
                type = this.enemyTypes.find(t => t.key === forceType);
            } else {
                type = Phaser.Utils.Array.GetRandom(this.enemyTypes);
            }
            // Create a texture for the enemy if it doesn't exist
            const texKey = `enemyRect_${type.key}`;
            if (!this.textures.exists(texKey)) {
                let graphics = this.add.graphics();
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
            // Spawn at a random position outside the screen
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
            // Set up movement pattern and random speed
            switch (type.behavior) {
                case 'track':
                    enemy.body.setVelocity(0, 0);
                    enemy.oscPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
                    enemy.moveSpeed = Phaser.Math.Between(40, 80); // random slow speed
                    break;
                case 'straight': {
                    const playerPos = this.getPlayerPosition();
                    const playerVel = this.player.body.velocity;
                    const predictX = playerPos.x + playerVel.x * 0.6;
                    const predictY = playerPos.y + playerVel.y * 0.6;
                    const angle = Phaser.Math.Angle.Between(x, y, predictX, predictY);
                    enemy.straightAngle = angle;
                    enemy.moveSpeed = Phaser.Math.Between(120, 180);
                    this.physics.velocityFromRotation(angle, enemy.moveSpeed, enemy.body.velocity);
                    enemy.straightStart = { x, y };
                    enemy.straightTime = 0;
                    break;
                }
                case 'diagonal':
                    const dx = Phaser.Math.Between(0, 1) ? 1 : -1;
                    const dy = Phaser.Math.Between(0, 1) ? 1 : -1;
                    enemy.moveSpeed = Phaser.Math.Between(120, 220);
                    enemy.body.setVelocity(enemy.moveSpeed * dx, enemy.moveSpeed * dy);
                    enemy.diagonalDir = { x: dx, y: dy };
                    break;
                case 'sinusoidal':
                    enemy.sinDir = Phaser.Math.Between(0, 1) ? 'h' : 'v';
                    enemy.sinStart = this.time.now;
                    enemy.amp = 100 + Phaser.Math.Between(0, 60);
                    enemy.freq = 4 + Phaser.Math.FloatBetween(0, 2);
                    enemy.baseX = x;
                    enemy.baseY = y;
                    enemy.moveSpeed = Phaser.Math.Between(80, 180);
                    enemy.body.setVelocity(0, 0);
                    break;
            }
        }
    }

    projectileHitEnemy(projectile, enemy) {
        projectile.setActive(false).setVisible(false);
        // Store enemy position before removing
        const ex = enemy.x;
        const ey = enemy.y;
        enemy.setActive(false).setVisible(false);
        // Create a blue circle orb at the enemy's position
        const orb = this.orbs.create(ex, ey, null);
        // Draw blue circle texture if not already present
        if (!this.textures.exists('expOrbBlue')) {
            const g = this.add.graphics();
            g.fillStyle(0x3399ff, 1);
            g.fillCircle(12, 12, 12);
            g.generateTexture('expOrbBlue', 24, 24);
            g.destroy();
        }
        orb.setTexture('expOrbBlue');
        orb.setDisplaySize(24, 24);
        orb.body.setAllowGravity(false);
        orb.setCircle(12);
        orb.setOrigin(0.5);
        orb.setActive(true).setVisible(true);
        orb.body.setVelocity(0, 0);
    }

    playerHitEnemy(player, enemy) {
        if (this.isPlayerInvincible) {
            return; // Do nothing if invincible
        }

        enemy.setActive(false).setVisible(false); // "Kill" the enemy that hit the player
        this.playerHealth -= 1;
        
        if (this.playerHealth <= 0) {
            // Game Over logic will go here
            this.scene.restart(); // For now, just restart the scene
        } else {
            // Trigger invincibility
            this.isPlayerInvincible = true;
            this.tweens.add({
                targets: this.player,
                alpha: { from: 0.5, to: 1.0 },
                ease: 'Linear',
                duration: 100,
                repeat: 10, // Blinks for 2 seconds (100ms * 2 * 10)
                yoyo: true,
                onComplete: () => {
                    this.player.setAlpha(1.0);
                    this.isPlayerInvincible = false;
                }
            });
        }
    }

    spawnSimpleOrb(x, y) {
        // Create a blue circle orb at (x, y)
        let orb = this.orbs.create(x, y, null);
        let graphics = this.add.graphics();
        graphics.fillStyle(0x3399ff, 1);
        graphics.fillCircle(0, 0, 12);
        graphics.generateTexture('simpleOrb', 24, 24);
        graphics.destroy();
        orb.setTexture('simpleOrb');
        orb.setDisplaySize(24, 24);
        orb.setCircle(12);
        orb.setOrigin(0.5);
        orb.setActive(true).setVisible(true);
        orb.body.setVelocity(0, 0);
    }

    collectOrb(player, orb) {
        orb.destroy();
        this.orbCount++;
        if (this.orbCount >= this.orbsToLevel) {
            this.orbCount = 0;
            this.playerLevel++;
            this.playerHealth = this.maxHealth; // Restore full health on level up
            this.openUpgradeMenu();
        }
    }

    openUpgradeMenu() {
        this.isUpgradeMenuOpen = true;
        // Randomly pick 4 upgrades
        const options = Phaser.Utils.Array.Shuffle(this.upgradeOptions).slice(0, 4);
        const width = this.sys.game.config.width;
        const height = this.sys.game.config.height;
        this.upgradeMenu = this.add.container(width / 2, height / 2);
        const bg = this.add.rectangle(0, 0, 400, 300, 0x222244, 0.95).setStrokeStyle(4, 0xffff00);
        this.upgradeMenu.add(bg);
        const title = this.add.text(0, -120, 'Level Up! Choose an Upgrade:', { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
        this.upgradeMenu.add(title);
        options.forEach((opt, i) => {
            const btn = this.add.rectangle(0, -40 + i * 60, 340, 50, 0x4444aa, 0.9).setStrokeStyle(2, 0xffffff).setInteractive();
            const txt = this.add.text(0, -40 + i * 60, opt.name, { fontSize: '20px', fill: '#ffff00' }).setOrigin(0.5);
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
        if (!this.isUpgradeMenuOpen) return;
        opt.apply();
        this.playerHealth = this.maxHealth;
        if (this.upgradeMenu) this.upgradeMenu.destroy();
        this.isUpgradeMenuOpen = false;
        this.scene.resume();
    }

    cleanupOutOfBounds() {
        const bounds = this.physics.world.bounds;
        const padding = 200; // Extra space outside the screen
        
        this.projectiles.children.each(child => {
            if (child.active && (child.x < -padding || child.x > bounds.width + padding || child.y < -padding || child.y > bounds.height + padding)) {
                child.setActive(false).setVisible(false);
            }
        });

        // Enemies are handled by the spawn logic (getting recycled)
        // Clean up orbs (only if far outside bounds)
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
        // Always ensure at least one red (track) enemy is on screen
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
                    // Home in on player, but with a visible oscillation for exaggeration
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
        this.setDepth(100); // Always on top
    }
}