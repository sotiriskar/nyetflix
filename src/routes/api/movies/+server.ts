import type { RequestHandler } from '@sveltejs/kit';
import pool from '$lib/database'; // Import your database connection

// GET /api/movies - Get all movies
export const GET: RequestHandler = async () => {
    try {
        const result = await pool.query('SELECT * FROM nyetflix.movies');
        return new Response(JSON.stringify(result.rows), { status: 200 });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};
