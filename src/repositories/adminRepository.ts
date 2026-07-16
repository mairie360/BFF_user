import { Pool } from 'pg';

export type AdministrationRole = {
    id: number;
    name: string;
};

export type AdministrationUser = {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    status: string;
    is_archived: boolean;
    roles: AdministrationRole[];
};

export type AdministrationGroup = {
    id: number;
    owner_id: number;
    name: string;
    description: string | null;
};

export type AdministrationGroupMember = Omit<AdministrationUser, 'roles'>;

const pool = new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'mairie_360_database',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'password',
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

export async function listAdministrationUsers({
    page,
    pageSize,
    search,
}: {
    page: number;
    pageSize: number;
    search?: string;
}) {
    const normalizedSearch = search?.trim() || null;
    const offset = (page - 1) * pageSize;
    const filter = `
        ($1::text IS NULL OR
            u.first_name ILIKE '%' || $1 || '%' OR
            u.last_name ILIKE '%' || $1 || '%' OR
            concat_ws(' ', u.first_name, u.last_name) ILIKE '%' || $1 || '%' OR
            concat_ws(' ', u.last_name, u.first_name) ILIKE '%' || $1 || '%' OR
            u.email ILIKE '%' || $1 || '%')
    `;

    const [usersResult, countResult] = await Promise.all([
        pool.query<AdministrationUser>(
            `
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone_number,
                u.status,
                COALESCE(u.is_archived, false) AS is_archived,
                COALESCE(
                    json_agg(
                        json_build_object('id', r.id, 'name', r.name)
                        ORDER BY r.name
                    ) FILTER (WHERE r.id IS NOT NULL),
                    '[]'::json
                ) AS roles
            FROM users u
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON r.id = ur.role_id
            WHERE ${filter}
            GROUP BY u.id
            ORDER BY u.last_name, u.first_name, u.id
            LIMIT $2 OFFSET $3
            `,
            [normalizedSearch, pageSize, offset],
        ),
        pool.query<{ total: number }>(
            `SELECT COUNT(*)::int AS total FROM users u WHERE ${filter}`,
            [normalizedSearch],
        ),
    ]);

    const total = countResult.rows[0]?.total ?? 0;

    return {
        users: usersResult.rows,
        page,
        page_size: pageSize,
        total,
        total_pages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
}

export async function isAdministrationUserAdmin(userId: number) {
    const result = await pool.query<{ is_admin: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = $1 AND lower(r.name) = 'admin'
        ) AS is_admin
        `,
        [userId],
    );

    return result.rows[0]?.is_admin ?? false;
}

export async function resetAdministrationUserPassword(
    userId: number,
    newPassword: string,
) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userResult = await client.query<{ id: number }>(
            `
            UPDATE users
            SET password = $1, first_connect = false
            WHERE id = $2
            RETURNING id
            `,
            [newPassword, userId],
        );

        if (userResult.rowCount !== 1) {
            await client.query('ROLLBACK');
            return false;
        }

        await client.query(
            `
            UPDATE sessions
            SET revoked_at = NOW()
            WHERE user_id = $1 AND revoked_at IS NULL
            `,
            [userId],
        );

        await client.query('COMMIT');
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function updateAdministrationGroup(
    groupId: number,
    input: { name?: string; description?: string },
) {
    const result = await pool.query<AdministrationGroup>(
        `
        UPDATE groups
        SET
            name = COALESCE($1, name),
            description = COALESCE($2, description)
        WHERE id = $3
        RETURNING id, owner_id, name, description
        `,
        [input.name ?? null, input.description ?? null, groupId],
    );

    return result.rows[0] ?? null;
}

export async function listAdministrationGroupMembers(groupId: number) {
    const result = await pool.query<AdministrationGroupMember>(
        `
        SELECT
            u.id,
            u.first_name,
            u.last_name,
            u.email,
            u.phone_number,
            u.status,
            COALESCE(u.is_archived, false) AS is_archived
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = $1
        ORDER BY u.last_name, u.first_name, u.id
        `,
        [groupId],
    );

    return result.rows;
}

export async function addAdministrationGroupMember(groupId: number, userId: number) {
    const result = await pool.query(
        `
        INSERT INTO group_members (group_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (group_id, user_id) DO NOTHING
        `,
        [groupId, userId],
    );

    return result.rowCount === 1;
}

export async function removeAdministrationGroupMember(groupId: number, userId: number) {
    const result = await pool.query(
        'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId],
    );

    return result.rowCount === 1;
}
