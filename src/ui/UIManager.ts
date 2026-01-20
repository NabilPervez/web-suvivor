import Phaser from 'phaser';

export class UIManager {
    private scene: Phaser.Scene;

    // HUD
    private healthIcons: Phaser.GameObjects.Graphics[] = [];
    private timerText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private expText!: Phaser.GameObjects.Text;
    private cooldownBarFill!: Phaser.GameObjects.Rectangle;
    // private dpadContainer!: Phaser.GameObjects.Container; // Removed

    // Input State from UI (Joystick)
    private joystickBase!: Phaser.GameObjects.Arc;
    private joystickThumb!: Phaser.GameObjects.Arc;
    private joystickPointer: Phaser.Input.Pointer | null = null;
    public joystickVector = { x: 0, y: 0 };
    private isMobile = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createHUD(width: number, height: number, maxHealth: number) {
        // --- Timer ---
        this.timerText = this.scene.add.text(width / 2, 20, 'Survive: 03:20', {
            fontSize: '24px', color: '#ffffff'
        }).setOrigin(0.5, 0).setDepth(1000);

        // --- Level & EXP ---
        this.levelText = this.scene.add.text(width - 30, 20, 'Lv. 1', {
            fontSize: '24px', color: '#ffff00', align: 'right'
        }).setOrigin(1, 0).setDepth(1000);

        this.expText = this.scene.add.text(width - 30, 50, 'EXP: 0/10', {
            fontSize: '20px', color: '#00ccff', align: 'right'
        }).setOrigin(1, 0).setDepth(1000);

        // --- Cooldown Bar ---
        const barWidth = 400; const barHeight = 18;
        const barY = height - 40;

        this.scene.add.rectangle(width / 2, barY, barWidth, barHeight, 0x222222, 0.7)
            .setDepth(1000); // BG
        this.cooldownBarFill = this.scene.add.rectangle(width / 2 - barWidth / 2, barY, 0, barHeight, 0x00ff66, 1)
            .setOrigin(0, 0.5).setDepth(1000);

        this.scene.add.text(width / 2, barY - 18, 'Weapon Cooldown', { fontSize: '16px', color: '#fff' })
            .setOrigin(0.5, 1).setDepth(1000);

        this.updateHealth(maxHealth, maxHealth);
    }

    updateHealth(current: number, max: number) {
        // Rebuild hearts if max changed, or just update visibility
        if (this.healthIcons.length !== max) {
            this.healthIcons.forEach(h => h.destroy());
            this.healthIcons = [];
            for (let i = 0; i < max; i++) {
                const h = this.scene.add.graphics();
                h.fillStyle(0xff0000, 1);
                h.fillTriangle(10, 0, 0, 10, 20, 10);
                h.fillCircle(5, 10, 5);
                h.fillCircle(15, 10, 5);
                h.x = 20 + (i * 25);
                h.y = 20;
                h.setDepth(1000);
                this.healthIcons.push(h);
            }
        }

        this.healthIcons.forEach((h, i) => {
            h.setVisible(i < current);
        });
    }

    updateTimer(ms: number) {
        // Countdown
        // Hardcoded import avoidance: 300000 = 5 mins
        const left = Math.max(0, 300000 - ms);
        const min = Math.floor(left / 60000).toString().padStart(2, '0');
        const sec = Math.floor((left % 60000) / 1000).toString().padStart(2, '0');
        this.timerText.setText(`Survive: ${min}:${sec}`);
    }

    updateLevel(level: number, currentXP: number, requiredXP: number) {
        this.levelText.setText(`Lv. ${level}`);
        this.expText.setText(`EXP: ${currentXP}/${requiredXP}`);
    }

    updateCooldown(progress: number) {
        // progress 0..1
        this.cooldownBarFill.width = 400 * progress;
        this.cooldownBarFill.setFillStyle(progress >= 1 ? 0x00ff66 : 0xff4444, 1);
    }

    createMobileControls() {
        const { width, height } = this.scene.scale;
        this.isMobile = width < 768; // Check if mobile

        if (!this.isMobile) return;

        const isLandscape = width > height;
        const radius = 60;

        // Position: Bottom-Center (Portrait) or Bottom-Left (Landscape)
        let x = width / 2;
        let y = height - 100;

        if (isLandscape) {
            x = 100;
            y = height - 100;
        }

        // Base
        this.joystickBase = this.scene.add.circle(x, y, radius, 0x333333, 0.5).setDepth(2000).setInteractive();

        // Thumb
        this.joystickThumb = this.scene.add.circle(x, y, 30, 0x666666, 0.8).setDepth(2001);

        // Input Handling
        this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.joystickBase.getBounds().contains(pointer.x, pointer.y)) {
                this.joystickPointer = pointer;
            }
        });

        this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.joystickPointer === pointer) {
                this.updateJoystick(pointer);
            }
        });

        this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (this.joystickPointer === pointer) {
                this.resetJoystick();
            }
        });
    }

    private updateJoystick(pointer: Phaser.Input.Pointer) {
        const base = this.joystickBase;
        const maxDist = 60; // radius of base

        const angle = Phaser.Math.Angle.Between(base.x, base.y, pointer.x, pointer.y);
        const dist = Phaser.Math.Distance.Between(base.x, base.y, pointer.x, pointer.y);
        const clampedDist = Math.min(dist, maxDist);

        this.joystickThumb.x = base.x + Math.cos(angle) * clampedDist;
        this.joystickThumb.y = base.y + Math.sin(angle) * clampedDist;

        // Normalize vector
        this.joystickVector.x = (this.joystickThumb.x - base.x) / maxDist;
        this.joystickVector.y = (this.joystickThumb.y - base.y) / maxDist;
    }

    private resetJoystick() {
        this.joystickPointer = null;
        this.joystickThumb.x = this.joystickBase.x;
        this.joystickThumb.y = this.joystickBase.y;
        this.joystickVector = { x: 0, y: 0 };
    }

    showUpgradeMenu(options: any[], onSelect: (opt: any) => void) {
        const { width, height } = this.scene.scale;
        const container = this.scene.add.container(width / 2, height / 2).setDepth(3000);

        container.add(this.scene.add.rectangle(0, 0, 420, 320, 0x222244, 0.95).setStrokeStyle(4, 0xffff00));
        container.add(this.scene.add.text(0, -120, 'Level Up! Choose:', { fontSize: '24px', color: '#fff' }).setOrigin(0.5));

        options.forEach((opt, i) => {
            const y = -40 + i * 60;
            const btn = this.scene.add.rectangle(0, y, 360, 50, 0x4444aa, 0.95)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive();

            const txt = this.scene.add.text(0, y, opt.displayName || opt.name, { fontSize: '20px', color: '#ffff00' }).setOrigin(0.5);

            btn.on('pointerdown', () => {
                container.destroy();
                onSelect(opt);
            });

            container.add([btn, txt]);
        });

        return container;
    }

    showGameOver(stats: string, onRestart: () => void, onCharSelect: () => void) {
        this.createFullScreenMenu('GAME OVER', 0x881111, stats, onRestart, onCharSelect);
    }

    showWin(stats: string, onRestart: () => void, onCharSelect: () => void) {
        this.createFullScreenMenu('YOU WIN!', 0x00aa00, stats, onRestart, onCharSelect);
    }

    private createFullScreenMenu(title: string, color: number, body: string, action: () => void, charSelect: () => void) {
        const { width, height } = this.scene.scale;
        const c = this.scene.add.container(width / 2, height / 2).setDepth(3000);

        c.add(this.scene.add.rectangle(0, 0, 600, 500, color, 0.95).setStrokeStyle(6, 0xffff00));
        c.add(this.scene.add.text(0, -200, title, { fontSize: '48px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5));
        c.add(this.scene.add.text(0, -20, body, { fontSize: '16px', color: '#fff', align: 'center', lineSpacing: 5 }).setOrigin(0.5));

        // Play Again
        const btn = this.scene.add.rectangle(0, 160, 220, 50, 0x4444aa, 0.95).setStrokeStyle(2, 0xffffff).setInteractive();
        const txt = this.scene.add.text(0, 160, 'Play Again', { fontSize: '20px', color: '#ffff00' }).setOrigin(0.5);
        btn.on('pointerdown', action);

        // Character Select
        const btn2 = this.scene.add.rectangle(0, 220, 220, 40, 0x444444, 0.95).setStrokeStyle(2, 0xaaaaaa).setInteractive();
        const txt2 = this.scene.add.text(0, 220, 'Character Select', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
        btn2.on('pointerdown', charSelect);

        c.add([btn, txt, btn2, txt2]);
    }
}
