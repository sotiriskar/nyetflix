import type { RequestHandler } from '@sveltejs/kit';
import { pool } from '$lib/postgres';

// GET /api/user/ - Get your user data from the database using the session cookie
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

// POST /api/user/ - Update user data in the database
export const POST: RequestHandler = async (request) => {
    try {
        const data = await request.request.json();
        const { userId, username, pronouns } = data;
        const result = await pool.query('UPDATE nyetflix.users SET username = $1, pronouns = $2 WHERE user_id = $3 RETURNING *', [username, pronouns, userId]);
        result.rows.forEach(row => {
            delete row.password;
        });
        return new Response(JSON.stringify(result.rows), { status: 200 });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};
