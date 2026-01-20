import Phaser from 'phaser';

export class Projectile extends Phaser.Physics.Arcade.Sprite {
    // private lifespan: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'fireball');
        // Check if texture exists, if not create a fallback (usually handled in preloader, but strict checks here)
    }

    public damage: number = 1;
    public pierce: number = 0;

    fire(x: number, y: number, angle: number, speed: number) {
        this.enableBody(true, x, y, true, true);
        this.setActive(true);
        this.setVisible(true);

        // Ensure texture exists - logic moved to Scene for efficiency or here if lazy loaded
        if (!this.scene.textures.exists('fireball')) {
            const graphics = this.scene.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(0xffa500, 1);
            graphics.fillRect(0, 0, 10, 10);
            graphics.generateTexture('fireball', 10, 10);
            graphics.destroy();
        }
        this.setTexture('fireball');

        this.scene.physics.velocityFromRotation(angle, speed, this.body!.velocity);
        // this.lifespan = 2000; 
    }

    fireAt(x: number, y: number, targetX: number, targetY: number, speed: number) {
        this.enableBody(true, x, y, true, true);
        this.setActive(true);
        this.setVisible(true);

        if (!this.scene.textures.exists('fireball')) {
            // ... fallback reused ...
            const graphics = this.scene.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(0xffa500, 1);
            graphics.fillRect(0, 0, 10, 10);
            graphics.generateTexture('fireball', 10, 10);
            graphics.destroy();
        }
        this.setTexture('fireball');

        this.scene.physics.moveTo(this, targetX, targetY, speed);
    }

    protected preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

        // Out of bounds check
        const bounds = this.scene.physics.world.bounds;
        const padding = 50;

        if (this.x < -padding || this.x > bounds.width + padding ||
            this.y < -padding || this.y > bounds.height + padding) {
            this.deactivate();
        }
    }

    deactivate() {
        this.setActive(false);
        this.setVisible(false);
        this.disableBody(true, true);
    }
}
