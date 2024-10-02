import type { RequestHandler } from '@sveltejs/kit';
import { serialize } from 'cookie';

export const DELETE: RequestHandler = async () => {
    const cookie = serialize('session', '', {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 0 // Delete the cookie
    });

    return new Response(JSON.stringify({ message: 'Logout successful' }), {
        status: 200,
        headers: {
            'Set-Cookie': cookie
        }
    });
};
