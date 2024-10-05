import type { RequestHandler } from '@sveltejs/kit';
import { pool } from '$lib/postgres';

// POST /api/user/delete - Delete user from the database
export const POST: RequestHandler = async (request) => {
    try {
        const data = await request.request.json();
        const { userId } = data;
        const result = await pool.query('DELETE FROM nyetflix.users WHERE user_id = $1 RETURNING *', [userId]);
        return new Response(JSON.stringify({ message: 'User deleted successfully', user: result.rows[0] }), { status: 200 });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};