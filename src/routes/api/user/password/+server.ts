import type { RequestHandler } from '@sveltejs/kit';
import { pool } from '$lib/postgres';

// POST /api/user/password - Change user password in the database
export const POST: RequestHandler = async (request) => {
    try {
        const data = await request.request.json();
        const { userId, newPassword } = data;
        console.log(userId, newPassword);
        const result = await pool.query('UPDATE nyetflix.users SET password = $1 WHERE user_id = $2 RETURNING *', [newPassword, userId]);
        result.rows.forEach(row => {
            delete row.password;
        });
        return new Response(JSON.stringify(result.rows), { status: 200 });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};