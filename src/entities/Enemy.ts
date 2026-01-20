import Phaser from 'phaser';

export interface EnemyConfig {
    key: string;
    color: number;
    behavior: 'track' | 'straight' | 'diagonal' | 'sinusoidal';
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    public behavior: string = 'track';
    public spawnTime: number = 0;

    // Custom props for behaviors
    public hp: number = 1;
    public maxHp: number = 1;
    private oscPhase: number = 0;
    private moveSpeed: number = 100;
    private straightAngle: number = 0;
    // private straightStart: { x: number, y: number } = { x: 0, y: 0 };
    // private diagonalDir: { x: number, y: number } = { x: 0, y: 0 };
    private amp: number = 0;
    private freq: number = 0;
    private baseX: number = 0;
    private baseY: number = 0;
    private sinDir: 'h' | 'v' = 'h';
    private playerRef: Phaser.GameObjects.GameObject | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, '');
    }

    setPlayerReference(player: Phaser.GameObjects.GameObject) {
        this.playerRef = player;
    }

    spawn(x: number, y: number, config: EnemyConfig) {
        this.enableBody(true, x, y, true, true);
        this.setActive(true);
        this.setVisible(true);
        this.behavior = config.behavior;
        this.spawnTime = this.scene.time.now;
        this.baseX = x;
        this.baseY = y;

        // Generate texture if missing
        const texKey = `enemyRect_${config.key}`;
        if (!this.scene.textures.exists(texKey)) {
            const graphics = this.scene.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(config.color, 1);
            graphics.fillRect(0, 0, 30, 30);
            graphics.generateTexture(texKey, 30, 30);
            graphics.destroy();
        }
        this.setTexture(texKey);

        // Init specific behavior params
        switch (this.behavior) {
            case 'track':
                this.oscPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
                this.moveSpeed = Phaser.Math.Between(30, 120);
                break;
            case 'straight':
                if (this.playerRef && this.playerRef instanceof Phaser.GameObjects.Sprite) {
                    const pBody = this.playerRef.body as Phaser.Physics.Arcade.Body;
                    const predictX = this.playerRef.x + pBody.velocity.x * 0.6;
                    const predictY = this.playerRef.y + pBody.velocity.y * 0.6;
                    this.straightAngle = Phaser.Math.Angle.Between(x, y, predictX, predictY);
                    this.moveSpeed = Phaser.Math.Between(80, 200);
                    this.scene.physics.velocityFromRotation(this.straightAngle, this.moveSpeed, this.body!.velocity);
                    // this.straightStart = { x, y };
                }
                break;
            case 'diagonal':
                const dx = Phaser.Math.Between(0, 1) ? 1 : -1;
                const dy = Phaser.Math.Between(0, 1) ? 1 : -1;
                this.moveSpeed = Phaser.Math.Between(60, 250);
                this.body!.velocity.x = this.moveSpeed * dx;
                this.body!.velocity.y = this.moveSpeed * dy;
                // this.diagonalDir = { x: dx, y: dy };
                break;
            case 'sinusoidal':
                this.sinDir = Phaser.Math.Between(0, 1) ? 'h' : 'v';
                this.amp = Phaser.Math.Between(50, 150);
                this.freq = Phaser.Math.FloatBetween(2, 6);
                this.moveSpeed = Phaser.Math.Between(50, 200);
                // Velocity handled in update, but we set 0 here
                this.body!.velocity.set(0);
                break;
        }
    }

    protected preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);
        if (!this.active) return;

        const t = (time - this.spawnTime) / 1000;

        switch (this.behavior) {
            case 'track':
                if (this.playerRef && this.playerRef instanceof Phaser.GameObjects.Sprite) {
                    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, this.playerRef.x, this.playerRef.y);
                    const osc = Math.sin(t * 2 + this.oscPhase) * Phaser.Math.DegToRad(30);
                    this.scene.physics.velocityFromRotation(baseAngle + osc, this.moveSpeed, this.body!.velocity);
                }
                break;
            case 'straight':
                // velocity already set, or manual update:
                // this.x = this.straightStart.x + Math.cos(this.straightAngle) * this.moveSpeed * t;
                // this.y = this.straightStart.y + Math.sin(this.straightAngle) * this.moveSpeed * t;
                // Using physics velocity is usually smoother for collisions
                break;
            case 'diagonal':
                const { width, height } = this.scene.sys.game.config;
                const w = Number(width);
                const h = Number(height);

                if (this.x < 0 || this.x > w) {
                    this.body!.velocity.x *= -1;
                }
                if (this.y < 0 || this.y > h) {
                    this.body!.velocity.y *= -1;
                }
                break;
            case 'sinusoidal':
                if (this.sinDir === 'h') {
                    this.x = this.baseX + this.moveSpeed * t;
                    this.y = this.baseY + this.amp * Math.sin(this.freq * t);
                } else {
                    this.y = this.baseY + this.moveSpeed * t;
                    this.x = this.baseX + this.amp * Math.sin(this.freq * t);
                }
                break;
        }
    }

    deactivate() {
        this.setActive(false);
        this.setVisible(false);
        this.disableBody(true, true);
    }
}
