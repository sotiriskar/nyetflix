import { type RequestHandler } from '@sveltejs/kit';
import pool from '$lib/postgres';

export const POST: RequestHandler = async ({ request, cookies }) => {
    const { username, password } = await request.json();
    try {
        const result = await pool.query('SELECT * FROM nyetflix.users WHERE username = $1 AND password = $2', [username, password]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const userInfo = {
                id: user.user_id,
                username: user.username,
                email: user.email, // Add any other user information you want to store
                pronouns: user.pronouns,
                created_at: user.created_at
            };

            cookies.set('session', JSON.stringify(userInfo), {
                path: '/',
                httpOnly: true, // Set to true for security
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 // 1 day
            });

            return new Response(JSON.stringify(userInfo), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        } else {
            return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
                status: 401,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (err) {
        console.error('Database error:', err);
        return new Response(JSON.stringify({ error: 'Database error' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};