import Phaser from 'phaser';
import { SHAPES, SHAPE_CONFIG, PlayerShape, PLAYER_STATS } from '../config';
import { Projectile } from './Projectile';

export class Player extends Phaser.Physics.Arcade.Sprite {
    public shape: PlayerShape = SHAPES.CIRCLE;
    public health: number = PLAYER_STATS.MAX_HEALTH;
    public maxHealth: number = PLAYER_STATS.MAX_HEALTH;
    public speed: number = PLAYER_STATS.BASE_SPEED;

    // Weapon stats
    public projectileCount: number = 1;
    public fireCooldown: number = 1000;
    public magnetRadius: number = 100;
    public damageMultiplier: number = 1;
    private lastFired: number = 0;

    private projectiles: Phaser.Physics.Arcade.Group;
    public isInvincible: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number, projectiles: Phaser.Physics.Arcade.Group) {
        super(scene, x, y, '');
        this.projectiles = projectiles;
    }

    init(shape: PlayerShape) {
        this.shape = shape;
        const config = SHAPE_CONFIG[shape];

        // Defaults
        this.fireCooldown = config.COOLDOWN;
        this.projectileCount = config.PROJECTILE_COUNT;

        // --- Draw Texture ---
        let texKey = `player_${shape}`;
        if (!this.scene.textures.exists(texKey)) {
            const graphics = this.scene.make.graphics({ x: 0, y: 0 });
            if (shape === SHAPES.CIRCLE) {
                graphics.fillStyle(config.COLOR, 1);
                graphics.fillCircle(16, 16, 16);
                graphics.generateTexture(texKey, 32, 32);
            } else if (shape === SHAPES.TRIANGLE) {
                graphics.fillStyle(config.COLOR, 1);
                graphics.fillTriangle(4, 28, 16, 0, 28, 28);
                graphics.generateTexture(texKey, 32, 32);
            } else if (shape === SHAPES.SQUARE) {
                graphics.fillStyle(config.COLOR, 1);
                graphics.fillRect(0, 0, 32, 32);
                graphics.generateTexture(texKey, 32, 32);
            }
            graphics.destroy();
        }
        this.setTexture(texKey);

        // Setup body
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        this.setCollideWorldBounds(true);
        this.setCircle(16);
        this.setDepth(200);
    }

    move(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: any, joystick: { x: number, y: number }) {
        this.setVelocity(0);
        let mx = 0;
        let my = 0;

        // Joystick override or Keyboard
        if (Math.abs(joystick.x) > 0.05 || Math.abs(joystick.y) > 0.05) {
            mx = joystick.x;
            my = joystick.y;
        } else {
            if (wasd.W.isDown || cursors.up.isDown) my = -1;
            else if (wasd.S.isDown || cursors.down.isDown) my = 1;

            if (wasd.A.isDown || cursors.left.isDown) mx = -1;
            else if (wasd.D.isDown || cursors.right.isDown) mx = 1;

            // Normalize keyboard to 1 if moving
            const mag = Math.sqrt(mx * mx + my * my);
            if (mag > 0) {
                mx /= mag; // Normalize
                my /= mag;
            }
        }

        // Apply speed
        this.setVelocity(mx * this.speed, my * this.speed);
    }

    autoFire(time: number, closestEnemy: Phaser.Physics.Arcade.Sprite | null) {
        if (time < this.lastFired + this.fireCooldown) return;
        if (!closestEnemy) return;

        // Firing Logic
        const angleToEnemy = Phaser.Math.Angle.Between(this.x, this.y, closestEnemy.x, closestEnemy.y);

        if (this.shape === SHAPES.SQUARE) {
            // Square specific: one towards, one away (180 deg) ? 
            // Original code: [angleToEnemy, angleToEnemy + PI]
            // Actually, "Squares fire in four directions" said comments, but code implemented 2.
            // Wait, config says PROJECTILE_COUNT 4. 
            // Let's implement generic spread logic that covers all cases properly.

            // If Square, maybe fire 4 cardinal directions relative to enemy? 
            // Regressing to original code logic for fidelity:

            const angles = [
                angleToEnemy,
                angleToEnemy + Math.PI / 2,
                angleToEnemy + Math.PI,
                angleToEnemy - Math.PI / 2
            ];

            angles.forEach(a => this.spawnProjectile(a));
        } else {
            const count = this.projectileCount;
            const spread = Phaser.Math.DegToRad(SHAPE_CONFIG[this.shape].SPREAD); // 30 deg for Tri/Circle

            for (let i = 0; i < count; i++) {
                // Fan effect
                let angle = angleToEnemy + spread * (i - (count - 1) / 2) / (count > 1 ? (count - 1) : 1);
                this.spawnProjectile(angle);
            }
        }

        this.lastFired = time;
    }

    private spawnProjectile(angle: number) {
        const p = this.projectiles.get(this.x, this.y) as Projectile;
        if (p) {
            p.damage = 1 * this.damageMultiplier;
            p.fire(this.x, this.y, angle, 500);
        }
    }

    takeDamage(amount: number) {
        if (this.isInvincible) return;
        this.health -= amount;
        this.isInvincible = true;

        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: PLAYER_STATS.INVINCIBLE_DURATION,
            yoyo: true,
            repeat: PLAYER_STATS.INVINCIBLE_FLASHES,
            onComplete: () => {
                this.setAlpha(1);
                this.isInvincible = false;
            }
        });
    }

    getCooldownProgress(time: number): number {
        const elapsed = time - this.lastFired;
        const p = elapsed / this.fireCooldown;
        return Phaser.Math.Clamp(p, 0, 1);
    }
}
