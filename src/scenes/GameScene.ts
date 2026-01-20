import Phaser from 'phaser';
import { UIManager } from '../ui/UIManager';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { GAME_CONFIG, ENEMY_TYPES, UPGRADES, PlayerShape, GameStats, DifficultyState } from '../config';
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
    private expToNextLevel = 1;

    // Difficulty
    // Difficulty & Stats
    private currentSpawnDelay = 150;
    private lastSpawnAdjust = 0;

    // Performance Tracking
    private stats: GameStats = {
        timeSurvived: 0,
        levelReached: 1,
        upgradesAvailable: 0,
        initialSpawnCount: 2,
        enemiesDestroyed: 0,
        orbsCollected: 0,
        orbsExpired: 0,
        avgOrbLife: 0,
        difficultyModifier: 1
    };
    private orbCreationTimes: Map<number, number> = new Map(); // Orb ID -> Creation Time
    private totalOrbLifetime = 0;

    // Adaptive State (Persisted via static or data pass)
    // For simplicity, using a static on the class for now, or localStorage
    private static NextRunDiff: DifficultyState = {
        spawnRateMod: 1.0,
        enemyCountMod: 1.0,
        xpMod: 1.0
    };

    constructor() {
        super({ key: 'GameScene' });
    }

    init(data: { playerShape: PlayerShape }) {
        this.data.set('shape', data.playerShape || 'circle');

        // Reset state on restart/init
        this.survivalTime = 0;
        this.gameWon = false;
        this.gameOver = false;
        this.isPaused = false;
        this.level = 1;
        this.exp = 0;
        this.expToNextLevel = 10;
        this.currentSpawnDelay = 150 * GameScene.NextRunDiff.spawnRateMod;
        this.lastSpawnAdjust = 0;

        // Reset Stats
        this.stats = {
            timeSurvived: 0,
            levelReached: 1,
            upgradesAvailable: 0,
            initialSpawnCount: Math.ceil(2 * GameScene.NextRunDiff.enemyCountMod),
            enemiesDestroyed: 0,
            orbsCollected: 0,
            orbsExpired: 0,
            avgOrbLife: 0,
            difficultyModifier: GameScene.NextRunDiff.spawnRateMod
        };
        this.orbCreationTimes.clear();
        this.totalOrbLifetime = 0;
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
        this.ui.createMobileControls();

        // --- Input ---
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,A,S,D');

        // --- Collisions ---
        this.physics.add.collider(this.projectiles, this.enemies, this.handleProjectileHit as any, undefined, this);
        this.physics.add.collider(this.enemies, this.enemies); // Separation
        this.physics.add.overlap(this.player, this.enemies, this.handlePlayerHit as any, undefined, this);
        this.physics.add.overlap(this.player, this.orbs, this.handleOrbCollect as any, undefined, this);

        // --- Spawner ---
        this.spawnTimer = this.time.addEvent({
            delay: this.currentSpawnDelay,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        // Initial spawn reduced (50% of 5 -> ~2) based on user request "reduce by 50% again"
        // Also applying difficulty mod
        const initialCount = this.stats.initialSpawnCount;
        for (let i = 0; i < initialCount; i++) this.spawnEnemy();
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
            // "reduce the spawn rate over time by 50%" - slowing down the ramp up
            // Original factor was 0.8 (aggressive). Let's try 0.9.
            this.currentSpawnDelay *= 0.9;
            this.spawnTimer.reset({
                delay: this.currentSpawnDelay,
                callback: this.spawnEnemy,
                callbackScope: this,
                loop: true
            });
        }

        // Entities
        this.player.move(this.cursors, this.wasd, this.ui.joystickVector);

        // Magnet Effect
        this.orbs.children.each((orb: any) => {
            if (!orb.active) return true;
            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, orb.x, orb.y);
            if (dist < this.player.magnetRadius) {
                this.physics.moveToObject(orb, this.player, 150);
            } else {
                (orb.body as Phaser.Physics.Arcade.Body).setVelocity(0);
            }
            return true;
        });

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

        // Wave Logic
        const mins = this.survivalTime / 60000;
        let pool: any[] = [ENEMY_TYPES[0], ENEMY_TYPES[1]]; // Red, Blue
        if (mins >= 1) {
            pool.push(ENEMY_TYPES[2], ENEMY_TYPES[3]); // Green, Yellow
        }

        const type = forceType
            ? ENEMY_TYPES.find(t => t.key === forceType)!
            : Phaser.Utils.Array.GetRandom(pool as any);

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
            // Scaling HP
            enemy.hp = enemy.maxHp = 1 + Math.floor(mins * 0.5); // Increase 1 HP every 2 mins roughly? Or stronger?
            // "Damage numbers... proof of power growth".
            // Let's make it more notable: 1 + floor(mins).
            enemy.hp = enemy.maxHp = 1 + Math.floor(mins);
        }
    }

    handleProjectileHit(projectile: Projectile, enemy: Enemy) {
        if (!projectile.active || !enemy.active) return;

        projectile.deactivate();

        const damage = projectile.damage || 1;
        enemy.hp -= damage;

        // Show damage number
        this.showFloatingText(enemy.x, enemy.y, `${damage}`);

        if (enemy.hp <= 0) {
            const ex = enemy.x;
            const ey = enemy.y;

            // Orb pooling
            this.spawnOrb(ex, ey);

            enemy.deactivate();
            this.stats.enemiesDestroyed++; // Track kill
            soundManager.playHit();
        } else {
            // Flash white?
            enemy.setTint(0xffffff);
            this.time.delayedCall(100, () => enemy.clearTint());
        }
    }

    showFloatingText(x: number, y: number, text: string) {
        const t = this.add.text(x, y, text, {
            fontSize: '20px',
            fontFamily: 'Arial', // Fallback
            color: '#fff',
            stroke: '#000',
            strokeThickness: 2
        }).setOrigin(0.5);

        this.tweens.add({
            targets: t,
            y: y - 30,
            alpha: 0,
            duration: 500,
            onComplete: () => t.destroy()
        });
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

        // Auto-expire (30s)
        // Store creation time for tracking
        // We use orb x/y as weak unique ID key for Map? Unsafe if recycled exact frame.
        // Better: add property to orb (it's dynamic)

        // Let's assume we can attach data to game object
        (orb as any).birthTime = this.time.now;

        this.time.delayedCall(GAME_CONFIG.ORB_LIFESPAN, () => {
            if (orb.active) {
                orb.setActive(false).setVisible(false);
                orb.disableBody(true, true);
                this.stats.orbsExpired++;
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

        this.stats.orbsCollected++;

        // Track lifespan
        const birth = (orb as any).birthTime || 0;
        if (birth > 0) {
            const life = this.time.now - birth;
            this.totalOrbLifetime += life;
            this.stats.avgOrbLife = this.totalOrbLifetime / this.stats.orbsCollected;
        }

        // XP Gain: 1 + scale with level
        const xpGain = 1 + Math.floor((this.level - 1) * 0.5) * GameScene.NextRunDiff.xpMod;
        this.exp += xpGain;
        if (this.exp >= this.expToNextLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.stats.levelReached = this.level;
        this.exp = 0;
        this.exp = 0;
        // Linear/Polynomial Scaling: Level * 5 + 5
        // Example: Lvl 1->2 (10), Lvl 2->3 (15)...
        this.expToNextLevel = this.level * 5 + 5;
        // Reset per level or accumulate? Usually "XP for next level" resets to 0.
        // Current logic: this.exp resets to 0. So expToNextLevel is the delta. Correct.

        if (this.player.health < this.player.maxHealth) {
            this.player.health++;
            this.ui.updateHealth(this.player.health, this.player.maxHealth);
        }

        soundManager.playLevelUp();
        this.pauseGame();

        // Randomize upgrades
        const pool = [...UPGRADES];
        Phaser.Utils.Array.Shuffle(pool);
        const options = pool.slice(0, 3);

        this.ui.showUpgradeMenu(options, (opt) => {
            this.applyUpgrade(opt.id);
            this.resumeGame();
        });
    }

    applyUpgrade(id: string) {
        this.stats.upgradesAvailable++; // Track upgrades taken
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
            case 'damage_up':
                this.player.damageMultiplier += 0.2; // +20%
                break;
            case 'magnet_range':
                this.player.magnetRadius += 30;
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
        this.stats.timeSurvived = this.survivalTime;
        this.pauseGame();
        soundManager.playWin();

        this.updateAdaptiveDifficulty(true);
        const report = this.generateReport();

        this.ui.showWin(report, () => this.scene.restart(), () => this.scene.start('MenuScene'));
    }

    handleGameOver() {
        this.gameOver = true;
        this.stats.timeSurvived = this.survivalTime;
        this.pauseGame();
        soundManager.playGameOver();

        this.updateAdaptiveDifficulty(false);
        const report = this.generateReport();

        this.ui.showGameOver(report, () => this.scene.restart(), () => this.scene.start('MenuScene'));
    }

    updateAdaptiveDifficulty(win: boolean) {
        // Goal: User gets to last 5 mins (300s? no currently 300s is win. so get to 200s+?)
        // If win or > 80% time, increase difficulty slightly (or keep stable)
        // If die early (< 50% time), make easier

        const progress = this.survivalTime / GAME_CONFIG.WIN_TIME_MS; // 0..1

        if (progress < 0.2) {
            // Died super early (< 1 min)
            GameScene.NextRunDiff.spawnRateMod *= 1.2; // 20% slower spawns
            GameScene.NextRunDiff.enemyCountMod *= 0.8; // 20% fewer enemies start
            GameScene.NextRunDiff.xpMod *= 1.2; // 20% more XP
        } else if (progress < 0.5) {
            // Died mid game
            GameScene.NextRunDiff.spawnRateMod *= 1.1;
            GameScene.NextRunDiff.xpMod *= 1.1;
        } else if (progress > 0.9 || win) {
            // Reached end game -> Normalize or slight harden? 
            // "intention to make the user get to the last five minutes"
            // If they are already there, we can stabilize.
            // Maybe reset slowly to 1?
            GameScene.NextRunDiff.spawnRateMod = (GameScene.NextRunDiff.spawnRateMod + 1.0) / 2;
            GameScene.NextRunDiff.enemyCountMod = (GameScene.NextRunDiff.enemyCountMod + 1.0) / 2;
            GameScene.NextRunDiff.xpMod = (GameScene.NextRunDiff.xpMod + 1.0) / 2;
        }

        // Clamp
        GameScene.NextRunDiff.enemyCountMod = Phaser.Math.Clamp(GameScene.NextRunDiff.enemyCountMod, 0.5, 3);
        GameScene.NextRunDiff.spawnRateMod = Phaser.Math.Clamp(GameScene.NextRunDiff.spawnRateMod, 0.5, 3);
        GameScene.NextRunDiff.xpMod = Phaser.Math.Clamp(GameScene.NextRunDiff.xpMod, 0.5, 5);

        console.log("Adaptive Difficulty for Next Run:", GameScene.NextRunDiff);
    }

    generateReport(): string {
        const s = this.stats;
        return `Survived: ${(s.timeSurvived / 1000).toFixed(1)}s
Level: ${s.levelReached}
Upgrades: ${s.upgradesAvailable}
Kills: ${s.enemiesDestroyed}
Orbs: ${s.orbsCollected} (Lost: ${s.orbsExpired})
Avg Orb Collection: ${(s.avgOrbLife / 1000).toFixed(1)}s
Start Spawn: ${s.initialSpawnCount}
Diff Mod: ${s.difficultyModifier.toFixed(2)}x`;
    }
}
