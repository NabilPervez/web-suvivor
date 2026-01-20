import Phaser from 'phaser';

export class UIManager {
    private scene: Phaser.Scene;

    // HUD
    private healthIcons: Phaser.GameObjects.Graphics[] = [];
    private timerText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private expText!: Phaser.GameObjects.Text;
    private cooldownBarFill!: Phaser.GameObjects.Rectangle;
    private dpadContainer!: Phaser.GameObjects.Container;

    // Input State from UI (D-Pad)
    public dpadState = { up: false, down: false, left: false, right: false };

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    createHUD(width: number, height: number, maxHealth: number) {
        // --- Timer ---
        this.timerText = this.scene.add.text(width / 2, 20, 'Time: 00:00', {
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
        const min = Math.floor(ms / 60000).toString().padStart(2, '0');
        const sec = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
        this.timerText.setText(`Time: ${min}:${sec}`);
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

    createDPad() {
        if (this.scene.scale.width >= 768) return; // Not mobile

        const dpadSize = 120;
        const x = 80;
        const y = this.scene.scale.height - 80;

        this.dpadContainer = this.scene.add.container(x, y).setDepth(2000);
        this.dpadContainer.add(this.scene.add.circle(0, 0, dpadSize / 2, 0x333333, 0.7));

        const dirs = [
            { key: 'up', x: 0, y: -40 },
            { key: 'down', x: 0, y: 40 },
            { key: 'left', x: -40, y: 0 },
            { key: 'right', x: 40, y: 0 }
        ] as const;

        dirs.forEach(d => {
            const btn = this.scene.add.circle(d.x, d.y, 25, 0x666666, 0.8)
                .setInteractive();

            const set = (v: boolean) => (this.dpadState as any)[d.key] = v;

            btn.on('pointerdown', () => set(true));
            btn.on('pointerup', () => set(false));
            btn.on('pointerout', () => set(false));

            this.dpadContainer.add(btn);
        });
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

            const txt = this.scene.add.text(0, y, opt.name, { fontSize: '20px', color: '#ffff00' }).setOrigin(0.5);

            btn.on('pointerdown', () => {
                container.destroy();
                onSelect(opt);
            });

            container.add([btn, txt]);
        });

        return container; // Return so we can destroy if needed externally? usually handled by click
    }

    showGameOver(stats: string, onRestart: () => void) {
        this.createFullScreenMenu('GAME OVER', 0x881111, stats, onRestart);
    }

    showWin(stats: string, onRestart: () => void) {
        this.createFullScreenMenu('YOU WIN!', 0x00aa00, stats, onRestart);
    }

    private createFullScreenMenu(title: string, color: number, body: string, action: () => void) {
        const { width, height } = this.scene.scale;
        const c = this.scene.add.container(width / 2, height / 2).setDepth(3000);

        c.add(this.scene.add.rectangle(0, 0, 500, 300, color, 0.95).setStrokeStyle(6, 0xffff00));
        c.add(this.scene.add.text(0, -70, title, { fontSize: '48px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5));
        c.add(this.scene.add.text(0, -10, body, { fontSize: '20px', color: '#fff', align: 'center' }).setOrigin(0.5));

        const btn = this.scene.add.rectangle(0, 90, 220, 50, 0x4444aa, 0.95).setStrokeStyle(2, 0xffffff).setInteractive();
        const txt = this.scene.add.text(0, 90, 'Play Again', { fontSize: '20px', color: '#ffff00' }).setOrigin(0.5);

        btn.on('pointerdown', action);
        c.add([btn, txt]);
    }
}
