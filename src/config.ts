export const OPS = {
    GRAVITY_Y: 0,
    DEBUG: false,
};

export const GAME_CONFIG = {
    WIDTH: 800,
    HEIGHT: 600,
    BG_COLOR: 0x1a1a1a,
    WIN_TIME_MS: 300000, // 5 minutes for shorter loop, user asked for 'last 5 mins' logic so maybe 600k? Let's go 5 mins for now.
    ORB_LIFESPAN: 30000,
};

export const PLAYER_STATS = {
    BASE_SPEED: 400,
    MAX_HEALTH: 4,
    INVINCIBLE_DURATION: 150,
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
        COOLDOWN: 3200,
        PROJECTILE_COUNT: 6,
        SPREAD: 360,
    },
    [SHAPES.TRIANGLE]: {
        COLOR: 0x00ffcc,
        COOLDOWN: 1600,
        PROJECTILE_COUNT: 3,
        SPREAD: 30,
    },
    [SHAPES.SQUARE]: {
        COLOR: 0xffa500,
        COOLDOWN: 2400,
        PROJECTILE_COUNT: 4,
        SPREAD: 90,
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
    {
        id: 'damage_up',
        name: '+20% Damage',
        description: 'Increases projectile damage',
    },
    {
        id: 'magnet_range',
        name: '+Magnet Range',
        description: 'Increases item pickup range',
    },
];

export interface GameStats {
    timeSurvived: number;
    levelReached: number;
    upgradesAvailable: number; // collected
    initialSpawnCount: number;
    enemiesDestroyed: number;
    orbsCollected: number;
    orbsExpired: number;
    avgOrbLife: number; // Average time orb existed before collection
    difficultyModifier: number; // The multiplier used this run
}

export interface DifficultyState {
    spawnRateMod: number; // Multiplier for delay (higher = easier)
    enemyCountMod: number; // Multiplier for volume (lower = easier)
    xpMod: number; // Multiplier for XP gain (higher = easier) - User said XP scale level, but initial params helps
}
