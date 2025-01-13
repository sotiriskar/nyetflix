import type { RequestHandler } from '@sveltejs/kit';
import pool from '$lib/postgres';

export const GET: RequestHandler = async ({ url }) => {
    const movieId = url.searchParams.get('movie_id');
    const userId = url.searchParams.get('user_id');
    
    if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing user_id parameter' }), { status: 400 });
    }

    try {
        let result;
        if (movieId) {
            result = await pool.query('SELECT * FROM nyetflix.last_seen WHERE movie_id = $1 AND user_id = $2', [movieId, userId]);
            if (result.rows.length === 0) {
                return new Response(JSON.stringify({ error: 'No record found' }), { status: 404 });
            }
            return new Response(JSON.stringify(result.rows[0]), { status: 200 });
        } else {
            result = await pool.query('SELECT * FROM nyetflix.last_seen WHERE user_id = $1', [userId]);
            if (result.rows.length === 0) {
                return new Response(JSON.stringify({ error: 'No records found' }), { status: 404 });
            }
            return new Response(JSON.stringify(result.rows), { status: 200 });
        }
    } catch (err) {
        console.error('GET request error:', err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};

export const POST: RequestHandler = async (request) => {
    try {
        const data = await request.request.json();
        const { user_id, movie_id, last_seen } = data;

        if (!user_id || !movie_id || !last_seen) {
            console.error('POST request error: Missing required fields', { user_id, movie_id, last_seen });
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
        }

        // Check if the record exists
        const checkResult = await pool.query(
            'SELECT * FROM nyetflix.last_seen WHERE user_id = $1 AND movie_id = $2',
            [user_id, movie_id]
        );

        let result;
        if (checkResult.rows.length > 0) {
            // Update the existing record
            result = await pool.query(
                `UPDATE nyetflix.last_seen
                 SET last_seen = $3
                 WHERE user_id = $1 AND movie_id = $2
                 RETURNING *`,
                [user_id, movie_id, last_seen]
            );
        } else {
            // Insert a new record
            result = await pool.query(
                `INSERT INTO nyetflix.last_seen (user_id, movie_id, last_seen)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [user_id, movie_id, last_seen]
            );
        }

        return new Response(JSON.stringify(result.rows), { status: 200 });
    } catch (err) {
        console.error('POST request error:', (err as Error).message);
        return new Response(JSON.stringify({ error: 'Database error', details: (err as Error).message }), { status: 500 });
    }
};