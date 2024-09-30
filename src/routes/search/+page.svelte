<script lang="ts">
    import '../../app.postcss';
    import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
    import { AppShell, storeHighlightJs, storePopup } from '@skeletonlabs/skeleton';
    import { Bookmark, BookmarkCheck } from 'lucide-svelte';
    import { page } from '$app/stores';
    import TopBar from '$lib/components/TopBar.svelte';
    import NavBar from '$lib/components/NavBar.svelte';
    import Modal from '$lib/components/Modal.svelte';
    import { writable } from 'svelte/store';
    import { onMount } from 'svelte';

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

    let bookmarkedMovies = writable(new Set());
    let filteredMovies: string | any[] = [];
    let currentTile: number = 0;
    let movieTitles: any[] = [];
    let hoverStates: any[] = [];
    let movies: any[] = [];
    let searchQuery = '';
    let modal: Modal;

    onMount(async () => {
        const response = await fetch('/api/movies');
        if (response.ok) {
            movies = await response.json();
            movieTitles = movies.map(movie => movie.title);
        } else {
            console.error('Failed to fetch movies:', response.statusText);
        }

        const userId = '1'; // Replace with actual user ID
        const bookmarkResponse = await fetch(`/api/users/${userId}/bookmark`);
        if (bookmarkResponse.ok) {
            const bookmarks = await bookmarkResponse.json();
            bookmarkedMovies.set(new Set(bookmarks.map((bookmark: { movie_id: any; }) => bookmark.movie_id)));
        } else {
            console.error('Failed to fetch bookmarks:', bookmarkResponse.statusText);
        }

        // Parse the URL to get the search query
        const urlParams = new URLSearchParams(window.location.search);
        searchQuery = urlParams.get('movie') || '';
        filterMovies();
    });

    async function toggleBookmark(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }, movieId: unknown) {
        event.preventDefault();
        event.stopPropagation();

        const userId = '1'; // Replace with actual user ID
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
                await fetch(`/api/users/${userId}/bookmark`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ movie_id: movieId })
                });
            } else {
                // Add bookmark
                await fetch(`/api/users/${userId}/bookmark`, {
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

    $: {
        const urlParams = new URLSearchParams($page.url.search);
        searchQuery = urlParams.get('movie') || '';
        filterMovies();
    }

    function openModal(movie: { movie_id: number; title: string; wide_poster: string; poster: string; youtube_trailer_url: string; type: string; bookmarked?: boolean; description?: string; rating?: number; duration?: number; } | null) {
        modal.openModal(movie);
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
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {#if filteredMovies.length > 0}
                    {#each filteredMovies as movie, index}
                        <div class="card w-full h-[380px] rounded-lg transform hover:scale-[115%] transition-transform duration-300 relative hover:z-10"
                            role="button"
                            tabindex="0"
                            on:click={() => openModal(movie)}
                            on:keydown={(event) => event.key === 'Enter' && openModal(movie)}
                            on:mouseenter={() => hoverStates[index] = true}
                            on:mouseleave={() => hoverStates[index] = false}>
                            {#if hoverStates[index]}
                                <iframe title={`Trailer for ${movie.title}`} src={`https://www.youtube.com/embed/${movie.youtube_trailer_url}?autoplay=1&controls=0&mute=1&loop=1`} class="w-full h-3/4 object-cover rounded-t-lg pointer-events-none"></iframe>
                            {:else}
                                <img src={movie.poster} alt={movie.title} class="w-full top-0 h-3/4 object-cover rounded-t-lg">
                            {/if}
                            <div class="flex justify-between items-center mt-2 pl-4 pr-4">
                                <div>
                                    <h2 class="text-xl font-bold">{movie.title}</h2>
                                    <span class="text-s">{movie.type.split(',').slice(0, 2).join(' • ')}</span>
                                </div>
                                <button type="button" class="btn-icon variant" on:click={(event) => toggleBookmark(event, movie.movie_id)}>
                                    {#if $bookmarkedMovies.has(movie.movie_id)}
                                        <BookmarkCheck/>
                                    {:else}
                                        <Bookmark />
                                    {/if}
                                </button>
                            </div>
                        </div>
                    {/each}
                {:else}
                    <p>No movies found for "{searchQuery}".</p>
                {/if}
            </div>
        </section>
    </section>
</AppShell>