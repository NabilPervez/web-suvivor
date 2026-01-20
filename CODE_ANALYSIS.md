# Code Analysis: Shape Survivor

## Overview
This project is a "Vampire Survivors" style arcade game built with **Phaser 3.70.0** using Vanilla JavaScript. It features a complete game loop including a main menu, gameplay scene, leveling system, enemy waves, and win/loss states.

## What Works
1.  **Core Mechanics**: The movement, auto-firing, and collision detection systems are functional and responsive. The implementation of different enemy behaviors (tracking, straight, diagonal, sinusoidal) adds good variety.
2.  **Scene Management**: Transitions between `MenuScene` and `GameScene` are handled correctly, including data passing for selected shapes.
3.  **Mobile Support**: The detection of mobile devices (`width < 768`) and dynamic creation of an on-screen D-Pad is a great accessibility feature.
4.  **Graphics**: dynamic texture generation using `Phaser.GameObjects.Graphics` works well for this geometric art style, avoiding the need for external asset loading overhead.

## Issues Identified & Fixed
During the review, a critical performance issue regarding **Object Pooling** was identified:
-   **Problem**: The code was using `destroy()` on enemies and XP orbs after they were killed or collected. This removes the object from memory. However, the game initialized `this.enemies` and `this.projectiles` as Phaser Physics Groups, which are designed to *recycle* objects. Calling `destroy()` forces the game to allocate new memory for every new enemy, leading to potential performance degradation (garbage collection stutters) over time.
-   **Fix Applied**: Instances of `destroy()` were replaced with `setActive(false).setVisible(false)`, and `create()` calls were changed to `get()`. This ensures that game objects are returned to the pool and reused, maintaining a stable memory footprint.

## Areas for Improvement

### 1. Code Architecture (Refactoring)
-   **Current State**: `GameScene.js` is a "God Class" with nearly 1000 lines. It handles input, rendering, game logic, collision, UI, and entity behavior.
-   **Recommendation**: Break logic into separate classes.
    -   Create `Player.js`, `Enemy.js`, `Projectile.js` extending `Phaser.Physics.Arcade.Sprite`.
    -   Create `UIManager.js` to handle the HUD and menus.
    -   **Why**: Improves readability and maintainability.

### 2. Configuration Management
-   **Current State**: "Magic numbers" are scattered throughout the code (e.g., `this.fireCooldown = 2000`, `enemy.moveSpeed = 120`).
-   **Recommendation**: Move all gameplay balance constants (speeds, damage, spawn rates, colors) into a `config.js` or `constants.js` file.
-   **Why**: Makes balancing the game much easier without hunting through logic code.

### 3. Audio
-   **Current State**: The game is silent.
-   **Recommendation**: Add a `SoundManager`. Even simple oscillator beeps (generated via Web Audio API or Phaser's sound manager) would improve the experience if no assets are desired.

### 4. Expansion Scaling
-   **Current State**: `spawnEnemy` and `projectileHitEnemy` have switch statements or logic blocks that will grow indefinitely as new features are added.
-   **Recommendation**: Use a data-driven approach for enemies. Define enemy stats in a JSON object and have a generic `Enemy` class consume that data.

### 5. Type Safety
-   **Current State**: Vanilla JavaScript.
-   **Recommendation**: formatting the code with JSDoc is a good start (which is partly present), but moving to **TypeScript** would prevent many potential bugs, especially regarding property access on dynamic game objects.
