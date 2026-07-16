import { Pool } from 'pg';
import { createClient } from 'redis';

const pool = new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'mairie_360_database',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

const redisClient = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

redisClient.on('error', (error) => {
    console.error('[BFF Auth] Redis first-connection error:', error.message);
});

let redisConnection: Promise<void> | null = null;

async function connectRedis() {
    if (redisClient.isOpen) return;

    redisConnection ??= redisClient.connect().then(() => undefined);

    try {
        await redisConnection;
    } finally {
        redisConnection = null;
    }
}

export async function resolveFirstConnectionUserId(token: string) {
    await connectRedis();
    const value = await redisClient.get(`${token}/first_connection_id`);
    const userId = Number(value);

    return Number.isInteger(userId) && userId > 0 ? userId : null;
}

export async function persistFirstConnectionPassword(userId: number, newPassword: string) {
    const result = await pool.query(
        `
        UPDATE users
        SET first_connect = false, password = $1
        WHERE id = $2
        `,
        [newPassword, userId],
    );

    if (result.rowCount !== 1) {
        throw new Error('The first-connection user no longer exists');
    }
}

export async function consumeFirstConnectionToken(token: string, userId: number) {
    await connectRedis();
    await redisClient.del([
        `${token}/first_connection_id`,
        `${userId}/first_connection_token`,
    ]);
}
