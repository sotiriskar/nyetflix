import type { RequestHandler } from '@sveltejs/kit';
import { pool } from '$lib/database';

// GET /api/users - Get your user data from the database using the session cookie
export const GET: RequestHandler = async (request) => {
    try {
        const session = request.locals.session;
        const userId = session.match(/"id":(\d+)/)[1];
        const result = await pool.query('SELECT * FROM nyetflix.users WHERE user_id = $1', [userId]);
        result.rows.forEach(row => {
            delete row.password;
        });
        return new Response(JSON.stringify(result.rows), { status: 200 });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};