<script lang="ts">
    import '../app.postcss';
    import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
    import { AppShell, storeHighlightJs, storePopup } from '@skeletonlabs/skeleton';
    import TopBar from '$lib/components/TopBar.svelte';
    import NavBar from '$lib/components/NavBar.svelte';
    import Modal from '$lib/components/Modal.svelte';
    import Carousel from '$lib/components/Carousel.svelte';
    import { writable } from 'svelte/store';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { Play } from 'lucide-svelte';
    import { goto } from '$app/navigation';

    // Highlight JS
    import hljs from 'highlight.js/lib/core';
    import 'highlight.js/styles/github-dark.css';
    import xml from 'highlight.js/lib/languages/xml'; // for HTML
    import css from 'highlight.js/lib/languages/css';
    import javascript from 'highlight.js/lib/languages/javascript';
    import typescript from 'highlight.js/lib/languages/typescript';

    hljs.registerLanguage('xml', xml); // for HTML
    hljs.registerLanguage('css', css);
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('typescript', typescript);
    storeHighlightJs.set(hljs);

    // Floating UI for Popups
    storePopup.set({ computePosition, autoUpdate, flip, shift, offset, arrow });

    let bookmarkedMovies = writable<Set<number>>(new Set());
    let filteredMovies: any[] = [];
    let searchQuery: string = '';
    let hoverStates: any[] = [];
    let currentTile: number = 0;
    let movieTitles: any[] = [];
    let movies: any[] = [];
    let modal: Modal;
    let title: string = 'Popular on Nyetflix';
    let userData: any = null;
    let selectedMovie: Movie | null = null;

    interface Movie {
        title: string;
        year: number;
        type: string;
        wide_poster: string;
        duration: number;
        rating: string;
        description: string;
        movie_id: string;
        poster: string;
    }

    onMount(async () => {
        try {
            const response = await fetch('/api/user/');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    userData = data[0];
                    if (userData.username) {
                    } else {
                        console.error('Username is undefined');
                    }
                } else {
                    console.error('User data array is empty or not an array');
                }
            } else {
                console.error('Failed to fetch user data:', await response.text());
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }

        const movieResponse = await fetch('/api/movies');
        if (movieResponse.ok) {
            movies = await movieResponse.json();
            selectedMovie = movies[0];
            movieTitles = movies.map(movie => movie.title);
        } else {
            console.error('Failed to fetch movies:', movieResponse.statusText);
        }

        if (userData && userData.user_id) {
            const bookmarkResponse = await fetch(`/api/user/${userData.user_id}/bookmark`);
            if (bookmarkResponse.ok) {
                const bookmarks = await bookmarkResponse.json();
                bookmarkedMovies.set(new Set(bookmarks.map((bookmark: { movie_id: any; }) => bookmark.movie_id)));
            } else {
                console.error('Failed to fetch bookmarks:', bookmarkResponse.statusText);
            }
        } else {
            console.error('User ID not found in userData');
        }
    });

    $: {
        const urlParams = new URLSearchParams($page.url.search);
        searchQuery = urlParams.get('movie') || '';
        filterMovies();
    }

    function filterMovies() {
        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            filteredMovies = movies.filter(movie =>
                movie.title.toLowerCase().includes(lowerCaseQuery)
            );
        } else {
            filteredMovies = movies; // Show all movies if no search query
        }
    }

    function openModal(movie: { movie_id: number; title: string; wide_poster: string; poster: string; youtube_trailer_url: string; type: string; bookmarked?: boolean; description?: string; rating?: number; duration?: number; } | null) {
        modal.openModal(movie);
    }

    async function toggleBookmark(event: MouseEvent, movieId: number) {
        event.preventDefault();
        event.stopPropagation();

        if (!userData || !userData.user_id) {
            console.error('User ID not found in userData');
            return;
        }

        let isCurrentlyBookmarked: boolean = false;
        bookmarkedMovies.update(set => {
            isCurrentlyBookmarked = set.has(movieId);
            if (isCurrentlyBookmarked) {
                set.delete(movieId);
            } else {
                set.add(movieId);
            }
            return new Set(set);
        });

        // Update the movies array to trigger reactivity
        movies = movies.map(movie => {
            if (movie.movie_id === movieId) {
                return { ...movie, bookmarked: !isCurrentlyBookmarked };
            }
            return movie;
        });

        try {
            if (isCurrentlyBookmarked) {
                // Remove bookmark
                await fetch(`/api/user/${userData.user_id}/bookmark`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ movie_id: movieId })
                });
            } else {
                // Add bookmark
                await fetch(`/api/user/${userData.user_id}/bookmark`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ movie_id: movieId })
                });
            }
        } catch (err) {
            console.error('Failed to toggle bookmark:', err);
            // Revert the UI change if the API call fails
            bookmarkedMovies.update(set => {
                if (isCurrentlyBookmarked) {
                    set.add(movieId);
                } else {
                    set.delete(movieId);
                }
                return new Set(set);
            });

            // Revert the movies array change
            movies = movies.map(movie => {
                if (movie.movie_id === movieId) {
                    return { ...movie, bookmarked: isCurrentlyBookmarked };
                }
                return movie;
            });
        }
    }

    function formatDuration(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    function playSelectedMovie() {
        if (selectedMovie) {
            goto(`/watch/${selectedMovie.movie_id}`);
        }
    }
</script>

<style>
    .main-content {
        margin-left: 80px; /* Adjust this value based on the actual width of your AppRail */
    }
</style>

<!-- Modal Component -->
<Modal
    bind:this={modal}
    {movies}
    {bookmarkedMovies}
/>

<!-- App Shell -->
<AppShell>
    <svelte:fragment slot="header">
        <TopBar {movies} {movieTitles} />
    </svelte:fragment>
    <!-- Flex Container -->
    <section class="flex w-full h-full">
        <!-- NavBar Component -->
        <NavBar bind:currentTile={currentTile} />
        <!-- Movies Grid -->
        <section class="pl-10 pr-10 pt-10 flex-grow main-content">
            {#if selectedMovie}
                <div class="relative w-full h-[26%] rounded-t-lg overflow-hidden">
                    <img src={selectedMovie.wide_poster} alt={selectedMovie.title} class="rounded-t-lg w-full h-full object-cover object-top">
                    <div class="absolute inset-0 bg-gradient-to-t from-surface-900 to-transparent rounded-t-lg"></div>
                    <div class="absolute top-10 left-10 text-white max-w-md">
                        <h1 class="text-3xl font-bold py-2">{selectedMovie.title}</h1>
                        <h4 class="text-sm flex space-x-4 py-4">
                            <span>{formatDuration(selectedMovie.duration)}</span>
                            <span>{selectedMovie.year}</span>
                            <span>{selectedMovie.rating}</span>
                            <span>{selectedMovie.type.split(',').slice(0,3).join(' • ')}</span>
                        </h4>
                        <div class="description-container">
                            <span class="text-sm break-words">{selectedMovie.description}</span>
                        </div>
                        <div class="btn-group-vertical variant-filled mt-4 plr-10">
                            <button on:click={playSelectedMovie}>
                                <Play class="black" fill="#111" />
                                <span class="text-xl">  Play</span>
                            </button>
                        </div>
                    </div>
                </div>
            {/if}
            <Carousel
                title="Popular on Nyetflix"
                {movies} 
                {userData}
                {bookmarkedMovies} 
                {openModal} 
                {playSelectedMovie}
            />
            <Carousel
                title="Trending Now"
                {movies} 
                {userData}
                {bookmarkedMovies} 
                {openModal} 
                {playSelectedMovie}
            />
            <Carousel
                title="Top Rated Movies"
                {movies} 
                {userData}
                {bookmarkedMovies} 
                {openModal} 
                {playSelectedMovie}
            />
    </section>
</AppShell>