import Phaser from 'phaser';
import { SHAPES, SHAPE_CONFIG } from '../config';

export class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        const { width, height } = this.scale;

        this.add.text(width / 2, 80, 'SHAPE SURVIVOR v2', {
            fontSize: '48px',
            color: '#fff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, 150, 'Choose Your Shape', {
            fontSize: '28px',
            color: '#ffff00'
        }).setOrigin(0.5);

        const shapes = [
            { key: SHAPES.DIAMOND, label: 'Diamond', ...SHAPE_CONFIG[SHAPES.DIAMOND] },
            { key: SHAPES.CIRCLE, label: 'Circle', ...SHAPE_CONFIG[SHAPES.CIRCLE] },
            { key: SHAPES.TRIANGLE, label: 'Triangle', ...SHAPE_CONFIG[SHAPES.TRIANGLE] },
            { key: SHAPES.SQUARE, label: 'Square', ...SHAPE_CONFIG[SHAPES.SQUARE] }
        ];

        const shapeY = 300;
        const spacing = 150; // Tighter spacing for 4 items

        shapes.forEach((shape, i) => {
            let x = width / 2 + (i - 1.5) * spacing; // Centered for 4 items: -1.5, -0.5, 0.5, 1.5
            let graphics = this.add.graphics({ x, y: shapeY });

            graphics.fillStyle(shape.COLOR, 1);
            if (shape.key === SHAPES.CIRCLE) {
                graphics.fillCircle(0, 0, 48);
            } else if (shape.key === SHAPES.TRIANGLE) {
                graphics.fillTriangle(-48, 40, 0, -48, 48, 40);
            } else if (shape.key === SHAPES.SQUARE) {
                graphics.fillRect(-48, -48, 96, 96);
            } else if (shape.key === SHAPES.DIAMOND) {
                graphics.beginPath();
                graphics.moveTo(0, -48);
                graphics.lineTo(48, 0);
                graphics.lineTo(0, 48);
                graphics.lineTo(-48, 0);
                graphics.closePath();
                graphics.fillPath();
            }

            let hit = this.add.zone(x, shapeY, 100, 100).setRectangleDropZone(100, 100).setInteractive();
            hit.on('pointerdown', () => this.startGame(shape.key));

            this.add.text(x, shapeY + 80, shape.label, { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
        });

        this.add.text(width / 2, height - 60, 'Desktop: WASD or Arrows | Mobile: Touch or D-Pad', {
            fontSize: '18px',
            color: '#aaa'
        }).setOrigin(0.5);
    }

    startGame(shapeKey: string) {
        this.scene.start('GameScene', { playerShape: shapeKey });
    }
}
