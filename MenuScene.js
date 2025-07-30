class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const width = this.sys.game.config.width;
        const height = this.sys.game.config.height;

        // Title
        this.add.text(width / 2, 80, 'SHAPE SURVIVOR', {
            fontSize: '48px',
            fill: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, 150, 'Choose Your Shape', {
            fontSize: '28px',
            fill: '#ffff00'
        }).setOrigin(0.5);

        // Shape options
        const shapes = [
            { key: 'circle', label: 'Circle', color: 0xffffff },
            { key: 'triangle', label: 'Triangle', color: 0x00ffcc },
            { key: 'square', label: 'Square', color: 0xffa500 }
        ];
        const shapeY = 300;
        const spacing = 200;
        shapes.forEach((shape, i) => {
            let x = width / 2 + (i - 1) * spacing;
            let graphics = this.add.graphics({ x, y: shapeY });
            graphics.fillStyle(shape.color, 1);
            if (shape.key === 'circle') {
                graphics.fillCircle(0, 0, 48);
            } else if (shape.key === 'triangle') {
                graphics.fillTriangle(-48, 40, 0, -48, 48, 40);
            } else if (shape.key === 'square') {
                graphics.fillRect(-48, -48, 96, 96);
            }
            // Add interactive hit area
            let hit = this.add.zone(x, shapeY, 100, 100).setRectangleDropZone(100, 100).setInteractive();
            hit.on('pointerdown', () => this.startGame(shape.key));
            // Label
            this.add.text(x, shapeY + 80, shape.label, { fontSize: '24px', fill: '#fff' }).setOrigin(0.5);
        });

        // Instructions
        this.add.text(width / 2, height - 60, 'Desktop: WASD or Arrows | Mobile: Touch or D-Pad', {
            fontSize: '18px',
            fill: '#aaa'
        }).setOrigin(0.5);
    }

    startGame(shapeKey) {
        this.scene.start('GameScene', { playerShape: shapeKey });
    }
} 