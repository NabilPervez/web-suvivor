import Phaser from 'phaser';
import { UIManager } from '../ui/UIManager';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { GAME_CONFIG, ENEMY_TYPES, UPGRADES, PlayerShape } from '../config';
import { soundManager } from '../managers/SoundManager';

export class GameScene extends Phaser.Scene {
    private player!: Player;
    private ui!: UIManager;

    // Groups
    private projectiles!: Phaser.Physics.Arcade.Group;
    private enemies!: Phaser.Physics.Arcade.Group;
    private orbs!: Phaser.Physics.Arcade.Group;

    // Inputs
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: any;

    // State
    private survivalTime = 0;
    private gameWon = false;
    private gameOver = false;
    private isPaused = false;
    private spawnTimer!: Phaser.Time.TimerEvent;

    // Leveling
    private level = 1;
    private exp = 0;
    private expToNextLevel = 10;

    // Difficulty
    private currentSpawnDelay = 150;
    private lastSpawnAdjust = 0;

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { playerShape: PlayerShape }) {
        this.data.set('shape', data.playerShape || 'circle');
    }

    create() {
        const shape = this.data.get('shape') as PlayerShape;

        // --- Setup Groups ---
        // Projectiles
        this.projectiles = this.physics.add.group({
            classType: Projectile,
            runChildUpdate: true,
            maxSize: 100
        });

        // Enemies
        this.enemies = this.physics.add.group({
            classType: Enemy,
            runChildUpdate: true,
            maxSize: 200
        });

        // Orbs
        this.orbs = this.physics.add.group({
            maxSize: 300
        });

        // --- Player ---
        this.player = new Player(this, GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2, this.projectiles);
        this.player.init(shape);

        // --- UI ---
        this.ui = new UIManager(this);
        this.ui.createHUD(this.scale.width, this.scale.height, this.player.maxHealth);
        this.ui.createDPad();

        // --- Input ---
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,A,S,D');

        // --- Collisions ---
        this.physics.add.collider(this.projectiles, this.enemies, this.handleProjectileHit as any, undefined, this);
        this.physics.add.overlap(this.player, this.enemies, this.handlePlayerHit as any, undefined, this);
        this.physics.add.overlap(this.player, this.orbs, this.handleOrbCollect as any, undefined, this);

        // --- Spawner ---
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        // Initial spawn
        for (let i = 0; i < 10; i++) this.spawnEnemy('red');
    }

    update(time: number, delta: number) {
        if (this.isPaused || this.gameOver) return;

        // Win Check
        this.survivalTime += delta;
        if (!this.gameWon && this.survivalTime >= GAME_CONFIG.WIN_TIME_MS) {
            this.handleWin();
            return;
        }

        // Difficulty Scaling
        const elapsedSec = Math.floor(this.survivalTime / 500);
        if (elapsedSec - this.lastSpawnAdjust >= 20) {
            this.lastSpawnAdjust = elapsedSec;
            this.currentSpawnDelay *= 0.8;
            this.spawnTimer.reset({
                delay: this.currentSpawnDelay,
                callback: this.spawnEnemy,
                callbackScope: this,
                loop: true
            });
        }

        // Entities
        this.player.move(this.cursors, this.wasd, this.ui.dpadState);

        let closest: Enemy | null = null;
        let minDist = Infinity;

        // Find closest enemy for auto-fire
        // Optimization: checking specific bounding box or using Quadtree is better but naive loop ok for <200
        this.enemies.children.each((e: any) => {
            if (e.active) {
                const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
                if (d < minDist) {
                    minDist = d;
                    closest = e;
                }
                // Update player ref for tracking
                if (e.setPlayerReference) e.setPlayerReference(this.player);
            }
            return true;
        });

        this.player.autoFire(time, closest as any);
        if (time - (this.player as any).lastFired === 0) soundManager.playShoot(); // Hacky check if fired this frame? 
        // Better: Player emits event or returns true.
        // For now, let's just make the sound inside Player or verify lastFired changed?
        // Actually, Player class lacks sound ref. Let's just put sound triggering in Player.autoFire via callback?
        // Or cleaner: Player has reference to SoundManager? No, keeping dependencies low.
        // Let's stick "Play Shoot" into Player.ts logic or just generic loop sound?
        // Player.ts calling SoundManager global import is fine.

        // UI Updates
        this.ui.updateTimer(this.survivalTime);
        this.ui.updateCooldown(this.player.getCooldownProgress(time));
        this.ui.updateLevel(this.level, this.exp, this.expToNextLevel);
    }

    spawnEnemy(forceType?: string) {
        if (this.isPaused) return;

        // Safety cap
        if (this.enemies.countActive() >= 150) return;

        const type = forceType
            ? ENEMY_TYPES.find(t => t.key === forceType)!
            : Phaser.Utils.Array.GetRandom(ENEMY_TYPES as any);

        // Edge Spawn
        const edge = Phaser.Math.Between(0, 3);
        const { width, height } = this.scale;
        let x = 0, y = 0;

        switch (edge) {
            case 0: x = Phaser.Math.Between(0, width); y = -50; break;
            case 1: x = width + 50; y = Phaser.Math.Between(0, height); break;
            case 2: x = Phaser.Math.Between(0, width); y = height + 50; break;
            case 3: x = -50; y = Phaser.Math.Between(0, height); break;
        }

        const enemy = this.enemies.get(x, y);
        if (enemy) {
            enemy.spawn(x, y, type);
            enemy.setPlayerReference(this.player);
        }
    }

    handleProjectileHit(projectile: Projectile, enemy: Enemy) {
        if (!projectile.active || !enemy.active) return;

        projectile.deactivate();

        const ex = enemy.x;
        const ey = enemy.y;

        // Orb pooling
        this.spawnOrb(ex, ey);

        enemy.deactivate();
        soundManager.playHit();
    }

    spawnOrb(x: number, y: number) {
        const orb = this.orbs.get(x, y);
        if (!orb) return;

        orb.setActive(true).setVisible(true);
        orb.enableBody(true, x, y, true, true);

        if (!this.textures.exists('expOrb')) {
            const g = this.make.graphics({ x: 0, y: 0 });
            g.fillStyle(0x3399ff, 1);
            g.fillCircle(12, 12, 12);
            g.generateTexture('expOrb', 24, 24);
            g.destroy();
        }
        orb.setTexture('expOrb');
        orb.setCircle(12);

        // Auto-expire
        this.time.delayedCall(5000, () => {
            if (orb.active) {
                orb.setActive(false).setVisible(false);
                orb.disableBody(true, true);
            }
        });
    }

    handlePlayerHit(player: Player, enemy: Enemy) {
        if (player.isInvincible || !enemy.active) return;

        player.takeDamage(1);
        soundManager.playHurt();
        this.ui.updateHealth(player.health, player.maxHealth);

        //enemy.deactivate(); // Original logic: touching enemy destroys it? Yes.
        // Step 34 replacement: enemy deactivated.
        enemy.deactivate();

        if (player.health <= 0) {
            this.handleGameOver();
        }
    }

    handleOrbCollect(_player: Player, orb: Phaser.Physics.Arcade.Sprite) {
        if (!orb.active) return;

        orb.setActive(false).setVisible(false);
        orb.disableBody(true, true);

        soundManager.playPickup();

        this.exp++;
        if (this.exp >= this.expToNextLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.exp = 0;
        this.expToNextLevel = Math.floor(this.expToNextLevel * 1.2);

        if (this.player.health < this.player.maxHealth) {
            this.player.health++;
            this.ui.updateHealth(this.player.health, this.player.maxHealth);
        }

        soundManager.playLevelUp();
        this.pauseGame();

        const options = UPGRADES.slice(0, 4); // Just picking first 4 static for now, randomization easy to add

        this.ui.showUpgradeMenu(options, (opt) => {
            this.applyUpgrade(opt.id);
            this.resumeGame();
        });
    }

    applyUpgrade(id: string) {
        switch (id) {
            case 'max_health':
                this.player.maxHealth++;
                this.player.health++;
                this.ui.updateHealth(this.player.health, this.player.maxHealth);
                break;
            case 'speed_up':
                this.player.speed = Math.round(this.player.speed * 1.15);
                break;
            case 'cooldown_down':
                this.player.fireCooldown = Math.max(200, Math.round(this.player.fireCooldown * 0.8));
                break;
            case 'projectile_up':
                this.player.projectileCount++;
                break;
        }
    }

    pauseGame() {
        this.isPaused = true;
        this.physics.pause();
        this.spawnTimer.paused = true;
    }

    resumeGame() {
        this.isPaused = false;
        this.physics.resume();
        this.spawnTimer.paused = false;
    }

    handleWin() {
        this.gameWon = true;
        this.pauseGame();
        soundManager.playWin();
        const stats = `Time: ${this.ui['timerText'].text.split(' ')[1]}\nLevel: ${this.level}`;
        this.ui.showWin(stats, () => this.scene.restart());
    }

    handleGameOver() {
        this.gameOver = true;
        this.pauseGame();
        soundManager.playGameOver();
        const stats = `Time: ${this.ui['timerText'].text.split(' ')[1]}\nLevel: ${this.level}`;
        this.ui.showGameOver(stats, () => this.scene.restart());
    }
}
