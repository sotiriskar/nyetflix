// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';


export const handle: Handle = async ({ event, resolve }) => {
    try {
        const { cookies } = event;
        const session = cookies.get('session');

        // Attach the session cookie to event.locals
        event.locals.session = session;

        // If session cookie exists and user tries to access login page, redirect to home
        if (session && event.url.pathname === '/login') {
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': '/'
                }
            });
        }

        // Allow access to the login page without the cookie
        if (event.url.pathname === '/login') {
            return resolve(event);
        }

        // Check for the session cookie
        if (!session) {
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': '/login'
                }
            });
        }

        return resolve(event);
    } catch (error) {
        console.error('Error in handle hook:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
};