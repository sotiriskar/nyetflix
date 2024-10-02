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

// POST /api/users - Update user data in the database
export const POST: RequestHandler = async (request) => {
    try {
        const session = request.locals.session;
        const userId = session.match(/"id":(\d+)/)[1];
        const result = await pool.query('SELECT * FROM nyetflix.users WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
        }
        
        // Assuming userData contains fields to be updated
        await pool.query(
            'UPDATE nyetflix.users SET username = $1, WHERE pronouns = $2',
            [result.rows[0].username, result.rows[0].pronouns]
        );

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};
