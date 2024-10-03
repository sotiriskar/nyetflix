import type { RequestHandler } from '@sveltejs/kit';
import pool from '$lib/postgres';

// POST /api/user/:id/bookmark
export const POST: RequestHandler = async ({ params, request }) => {
    const { id } = params;
    const { movie_id } = await request.json();

    try {
        await pool.query('INSERT INTO nyetflix.user_bookmarks (user_id, movie_id) VALUES ($1, $2)', [id, movie_id]);
        return new Response(JSON.stringify({ message: 'Movie bookmarked!' }), { status: 200 });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};

// DELETE /api/user/:id/bookmark
export const DELETE: RequestHandler = async ({ params, request }) => {
    const { id } = params;
    const { movie_id } = await request.json();

    try {
        await pool.query('DELETE FROM nyetflix.user_bookmarks WHERE user_id = $1 AND movie_id = $2', [id, movie_id]);
        return new Response(JSON.stringify({ message: 'Bookmark removed!' }), { status: 200 });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};

// GET /api/user/:id/bookmark
export const GET: RequestHandler = async ({ params }) => {
    const { id } = params;

    try {
        const result = await pool.query('SELECT movie_id FROM nyetflix.user_bookmarks WHERE user_id = $1', [id]);
        return new Response(JSON.stringify(result.rows), { status: 200 });
    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500 });
    }
};