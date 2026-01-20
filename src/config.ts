export const OPS = {
    GRAVITY_Y: 0,
    DEBUG: false, // Set true for physics debugging
};

export const GAME_CONFIG = {
    WIDTH: 800,
    HEIGHT: 600,
    BG_COLOR: 0x1a1a1a,
    WIN_TIME_MS: 200000,
};

export const PLAYER_STATS = {
    BASE_SPEED: 400,
    MAX_HEALTH: 4,
    INVINCIBLE_DURATION: 150, // ms per flash
    INVINCIBLE_FLASHES: 4,
};

export const SHAPES = {
    CIRCLE: 'circle',
    TRIANGLE: 'triangle',
    SQUARE: 'square',
} as const;

export type PlayerShape = typeof SHAPES[keyof typeof SHAPES];

export const SHAPE_CONFIG = {
    [SHAPES.CIRCLE]: {
        COLOR: 0xffffff,
        COOLDOWN: 4000,
        PROJECTILE_COUNT: 6,
        SPREAD: 360,
    },
    [SHAPES.TRIANGLE]: {
        COLOR: 0x00ffcc,
        COOLDOWN: 2000,
        PROJECTILE_COUNT: 3,
        SPREAD: 30,
    },
    [SHAPES.SQUARE]: {
        COLOR: 0xffa500,
        COOLDOWN: 3000,
        PROJECTILE_COUNT: 4,
        SPREAD: 90, // Not exactly spread, but 4 directions
    },
};

export const ENEMY_TYPES = [
    { key: 'red', color: 0xff0000, behavior: 'track' },
    { key: 'blue', color: 0x3399ff, behavior: 'straight' },
    { key: 'green', color: 0x33ff33, behavior: 'diagonal' },
    { key: 'yellow', color: 0xffff33, behavior: 'sinusoidal' },
] as const;

export const UPGRADES = [
    {
        id: 'max_health',
        name: '+1 Max Health',
        description: 'Increases maximum health by 1',
    },
    {
        id: 'speed_up',
        name: '+15% Speed',
        description: 'Increases movement speed by 15%',
    },
    {
        id: 'cooldown_down',
        name: '-20% Cooldown',
        description: 'Reduces firing cooldown by 20%',
    },
    {
        id: 'projectile_up',
        name: '+1 Projectile',
        description: 'Fires an additional projectile',
    },
];
