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

    private upgradeCounts: Map<string, number> = new Map();
    private lastEliteTime = 0;

    // Fibonacci scaling
    private static readonly FIB = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
    private getMaxEnemies(): number {
        // Start scaling after 3s
        if (this.survivalTime < 3000) return 1;

        // Scale every 20s roughly?
        // Or "gradually over time"
        // Let's increment index every 10 seconds after the first 3s
        const step = Math.floor((this.survivalTime - 3000) / 20000);
        // 20s intervals for 5 mins = 15 steps. FIB[15] is safely large.

        const idx = Math.min(step + 1, GameScene.FIB.length - 1);
        // Apply enemyCountMod multiplier to the cap too?
        return Math.floor(GameScene.FIB[idx] * GameScene.NextRunDiff.enemyCountMod);
    }

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
        this.upgradeCounts.clear();
        this.lastEliteTime = 0;
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

        // Initial spawn: Just 1 Red enemy (force start small)
        // User requested: "start the game with only 1 red enemy"
        this.spawnEnemy('red');
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

        // Safety cap using Fibonacci
        const maxEnemies = this.getMaxEnemies();
        // Hard cap of 200 for performance (group size is 200)
        const hardCap = 150;
        if (this.enemies.countActive() >= Math.min(maxEnemies, hardCap)) return;

        // Wave Logic
        // Fixed: Ensure pool is typed correctly for Random
        const mins = this.survivalTime / 60000;
        let pool: any[] = [ENEMY_TYPES[0]]; // Start with Red only

        // Mins 0-1: Red + Blue (low chance)
        if (mins > 0.5) pool.push(ENEMY_TYPES[1]); // Blue enters at 30s

        // Mins 1+: Green
        if (mins >= 1) pool.push(ENEMY_TYPES[2]);

        // Mins 2+: Yellow
        if (mins >= 2) pool.push(ENEMY_TYPES[3]);

        const type = forceType
            ? ENEMY_TYPES.find(t => t.key === forceType)!
            : Phaser.Utils.Array.GetRandom(pool);

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

        // Elite Check (every 60s)
        if (this.survivalTime - this.lastEliteTime > 60000) {
            this.lastEliteTime = this.survivalTime;
            this.spawnElite();
        }
    }

    spawnElite() {
        // Find a safe spot? Or just random edge
        const x = Phaser.Math.Between(100, 700);
        const y = -100; // Top
        const elite = this.enemies.get(x, y);
        if (elite) {
            elite.spawn(x, y, ENEMY_TYPES[0]); // Red base
            elite.setPlayerReference(this.player);
            elite.setScale(2.5);
            elite.hp = elite.maxHp = 50 * (1 + this.survivalTime / 60000);
            elite.setTint(0xff00ff); // Purple
            (elite as any).isElite = true;
        }
    }

    handleProjectileHit(projectile: Projectile, enemy: Enemy) {
        if (!projectile.active || !enemy.active) return;

        // Off-screen invincibility
        // Check if enemy is in camera view
        const camera = this.cameras.main;
        // Simple bounds check with margin of -20 (slightly inside)
        const margin = -20;

        if (enemy.x < camera.worldView.x - margin ||
            enemy.x > camera.worldView.right + margin ||
            enemy.y < camera.worldView.y - margin ||
            enemy.y > camera.worldView.bottom + margin) {

            // Invincible off screen
            projectile.deactivate();
            return;
        }

        // Piercing logic
        if (projectile.pierce > 0) {
            projectile.pierce--;
        } else {
            projectile.deactivate();
        }

        const damage = projectile.damage || 1;
        enemy.hp -= damage;

        // Show damage number
        this.showFloatingText(enemy.x, enemy.y, `${damage}`);

        if (enemy.hp <= 0) {
            const ex = enemy.x;
            const ey = enemy.y;

            // Orb pooling
            if ((enemy as any).isElite) {
                // Drop Chest or Guaranteed upgrade?
                // For now, simpler: massive XP + special event? 
                // Requests: "drops a chest (guaranteed upgrade + health)"
                // Let's drop a Gold Box (Chest) which is an Orb with special flag
                this.spawnChest(ex, ey);
            } else {
                this.spawnOrb(ex, ey);
            }

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

        // Gold Orb logic
        // 1/200 chance or special
        const isGold = Phaser.Math.Between(0, 200) === 0;

        if (isGold) {
            orb.setTint(0xffd700); // Gold
            (orb as any).isGold = true;
            orb.setScale(1.5);
        } else {
            orb.clearTint();
            (orb as any).isGold = false;
            orb.setScale(1.0);
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

    spawnChest(x: number, y: number) {
        // Reusing orb group but with chest visual?
        // Or specific chest sprite
        const chest = this.orbs.get(x, y);
        if (!chest) return;

        chest.setActive(true).setVisible(true);
        chest.enableBody(true, x, y, true, true);
        chest.setTexture('expOrb'); // Placeholder
        chest.setTint(0xff00ff); // Magenta
        chest.setScale(2.0);
        (chest as any).isChest = true;
        (chest as any).birthTime = this.time.now;
        // No expiry for chest?
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

        // Chest logic
        if ((orb as any).isChest) {
            orb.setActive(false).setVisible(false);
            orb.disableBody(true, true);
            soundManager.playPickup(); // If exists, or just Pickup
            // Heal
            this.player.health = Math.min(this.player.health + 2, this.player.maxHealth);
            this.ui.updateHealth(this.player.health, this.player.maxHealth);
            // Free Upgrade
            this.handleChestOpen();
            return;
        }

        // Gold Orb Logic
        if ((orb as any).isGold) {
            this.collectAllOrbs();
        }

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

    collectAllOrbs() {
        this.orbs.children.each((o: any) => {
            if (o.active && !o.isChest) {
                this.physics.moveToObject(o, this.player, 800); // Fast suck
            }
            return true;
        });
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

        // Evolution Checks
        const pool = [...UPGRADES];
        // Filter out evolutions initially
        let valid = pool.filter(u => !(u as any).isEvolution);

        // Check for evolutions (Requirement: 10 levels)
        const pLvl = this.upgradeCounts.get('projectile_up') || 0;
        if (pLvl >= 10) valid.push(pool.find(u => u.id === 'evo_pierce')!);

        const cLvl = this.upgradeCounts.get('cooldown_down') || 0;
        if (cLvl >= 10) valid.push(pool.find(u => u.id === 'evo_rapid')!);

        Phaser.Utils.Array.Shuffle(valid);
        const options = valid.slice(0, 3);

        // Decorate options with count
        const optionsWithCounts = options.map(opt => {
            const count = this.upgradeCounts.get(opt.id) || 0;
            return { ...opt, displayName: `${opt.name} (${count})` };
        });

        this.ui.showUpgradeMenu(optionsWithCounts, (opt) => {
            this.applyUpgrade(opt.id);
            this.resumeGame();
        });
    }

    handleChestOpen() {
        this.pauseGame();
        // Guaranteed upgrade
        // Similar logic to level up but maybe forced "Good" one? 
        // For now just show menu
        const pool = [...UPGRADES].filter(u => !(u as any).isEvolution);
        Phaser.Utils.Array.Shuffle(pool);
        this.ui.showUpgradeMenu(pool.slice(0, 3), (opt) => {
            this.applyUpgrade(opt.id);
            this.resumeGame();
        });
    }

    applyUpgrade(id: string) {
        this.stats.upgradesAvailable++; // Track upgrades taken
        const current = this.upgradeCounts.get(id) || 0;
        this.upgradeCounts.set(id, current + 1);

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
                this.player.fireCooldown = Math.max(50, Math.round(this.player.fireCooldown * 0.8));
                break;
            case 'evo_rapid': // Mini-gun
                this.player.fireCooldown = 100;
                break;
            case 'projectile_up':
                this.player.projectileCount++;
                break;
            case 'evo_pierce': // Death Ray
                this.player.pierceCount += 100;
                this.player.damageMultiplier *= 2;
                this.player.setScale(1.5); // Giant
                break;
            case 'damage_up':
                this.player.damageMultiplier += 0.2; // +20%
                break;
            case 'magnet_range':
                this.player.magnetRadius += 30;
                break;
            case 'pierce_up':
                this.player.pierceCount++;
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
