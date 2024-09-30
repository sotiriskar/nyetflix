import type { Load } from '@sveltejs/kit';

export const load: Load = async ({ fetch }) => {
    const response = await fetch('/api/movies');

    if (!response.ok) {
        // Handle error (e.g., throw an error or return an empty array)
        console.error('Failed to fetch movies:', response.statusText);
        return {
            movies: []  // Return an empty array in case of an error
        };
    }
    const movies = await response.json();

    return {
        movies: movies || [] // Ensure movies is always an array
    };
};
