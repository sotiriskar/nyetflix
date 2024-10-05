<script lang="ts">
    import '../app.postcss';
    import { ChevronLeft, ChevronRight, CirclePlay, CircleChevronDown, CircleX, CirclePlus, Play } from 'lucide-svelte';
    import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
    import { AppShell, storeHighlightJs, storePopup } from '@skeletonlabs/skeleton';
    import { Bookmark, BookmarkCheck } from 'lucide-svelte';
    import TopBar from '$lib/components/TopBar.svelte';
    import NavBar from '$lib/components/NavBar.svelte';
    import Modal from '../lib/components/Modal.svelte';
    import { writable } from 'svelte/store';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
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

    let bookmarkedMovies = writable(new Set());
    let filteredMovies: any[] = [];
    let searchQuery: string = '';
    let hoverStates: any[] = [];
    let currentTile: number = 0;
    let movieTitles: any[] = [];
    let movies: any[] = [];
    let modal: Modal;
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

    let elemMovies: HTMLDivElement;

    function multiColumnLeft(): void {
        let x = elemMovies.scrollWidth;
        if (elemMovies.scrollLeft !== 0) x = elemMovies.scrollLeft - elemMovies.clientWidth;
        elemMovies.scroll(x, 0);
    }

    function multiColumnRight(): void {
        let x = 0;
        // -1 is used because different browsers use different methods to round scrollWidth pixels.
        if (elemMovies.scrollLeft < elemMovies.scrollWidth - elemMovies.clientWidth - 1) x = elemMovies.scrollLeft + elemMovies.clientWidth;
        elemMovies.scroll(x, 0);
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
                <div class="relative w-full h-96">
                    <img src={selectedMovie.wide_poster} alt={selectedMovie.title} class="w-full h-full object-cover object-top">
                    <div class="absolute inset-0 bg-gradient-to-r from-surface-900 to-transparent via-surface-900/90 via-40% to-70%"></div>
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
            <section class="overflow-visible">
                <h2 class="text-2xl font-bold w-full pl-[100px] relative top-14">Popular on Nyetflix</h2>
                <div class="relative flex items-center">
                    <!-- Button: Left -->
                    <button type="button" class="w-20 h-40 z-10" on:click={multiColumnLeft}>
                        <ChevronLeft class="white transition-transform transform hover:scale-[115%] w-full h-full" />
                    </button>
                    <!-- Carousel -->
                    <div class="relative pt-20 pb-20 snap-x snap-mandatory scroll-smooth flex gap-2 overflow-x-auto overflow-y-visible flex-grow pl-20">
                        {#each movies as movie, index}
                            <button type="button" class="card shrink-0 h-[170px] md:w-[22%] snap-start transform hover:scale-y-[160%] hover:scale-x-[160%] transition-transform duration-300 relative hover:z-10 rounded-none" aria-label={`Select ${movie.title}`}
                                on:keydown={(event) => event.key === 'Enter' && openModal(movie)}
                                on:mouseenter={() => hoverStates[index] = true}
                                on:mouseleave={() => hoverStates[index] = false}>
                                {#if hoverStates[index]}
                                <div class="overflow-hidden w-full h-full relative flex flex-col">
                                    <button class="h-4/6 relative overflow-hidden" on:click={() => openModal(movie)}>
                                        <div class="scale-150 origin-center w-full h-full">
                                            <iframe title={`Trailer for ${movie.title}`} src={`https://www.youtube.com/embed/${movie.youtube_trailer_url}?autoplay=1&controls=0&mute=1&loop=1&rel=0`}
                                                    id="iframe" class="absolute top-0 left-0 w-full h-full object-cover pointer-events-none">
                                            </iframe>
                                        </div>
                                    </button>
                                    <div class="h-1/6 w-full flex justify-between items-center overflow-visible">
                                        <div class="pl-3 pt-3">
                                            <button type="button" class="z-10" on:click={playSelectedMovie}>
                                                <CirclePlay strokeWidth={1} class="flex-shrink-0 flex-grow-0 hover:bg-slate-200 hover:bg-opacity-25 hover:rounded-full"/>
                                            </button>
                                            <button type="button" class="z-10" on:click={(event) => toggleBookmark(event, movie.movie_id)}>
                                                {#if $bookmarkedMovies.has(movie.movie_id)}
                                                    <CircleX strokeWidth={1} class="flex-shrink-0 flex-grow-0 hover:bg-slate-200 hover:bg-opacity-25 hover:rounded-full"/>
                                                {:else}
                                                    <CirclePlus strokeWidth={1} class="flex-shrink-0 flex-grow-0 hover:bg-slate-200 hover:bg-opacity-25 hover:rounded-full"/>
                                                {/if}
                                            </button>
                                        </div>
                                        <button type="button" class="pt-2 btn-icon z-10 h-full" on:click={() => openModal(movie)}>
                                            <CircleChevronDown strokeWidth={1} class="flex-shrink-0 flex-grow-0 hover:bg-slate-200 hover:bg-opacity-25 hover:rounded-full"/>
                                        </button>
                                    </div>
                                    <div class="h-2/7 w-full flex justify-start pl-3 pt-1 overflow-hidden">
                                        <span class="text-xs">{movie.type.split(',').slice(0, 2).join(' • ')}</span>
                                    </div>
                                </div>
                                {:else}
                                    <div class="w-full h-full object-cover">
                                        <img src={movie.poster} alt={movie.title} class="w-full h-full object-cover">
                                    </div>
                                {/if}
                            </button>
                        {/each}
                    </div>
                    <!-- Button: Right -->
                    <button type="button" class="w-20 h-40 z-10" on:click={multiColumnRight}>
                        <ChevronRight class="white transition-transform transform hover:scale-[115%] w-full h-full" />
                    </button>
                </div>
            </section>
            <h1 class="text-2xl pt-5 pb-4 ml-1">Popular on Nyetflix</h1>
            <div class="grid grid-cols-2 md:grid-cols-7 gap-4 mb-10">
                {#each movies as movie, index}
                    <div class="card w-full h-[300px] overflow-hidden transform hover:scale-y-[115%] hover:scale-x-[125%] transition-transform duration-300 relative hover:z-10"
                        role="button"
                        tabindex="0"
                        on:click={() => openModal(movie)}
                        on:keydown={(event) => event.key === 'Enter' && openModal(movie)}
                        on:mouseenter={() => hoverStates[index] = true}
                        on:mouseleave={() => hoverStates[index] = false}>
                        <!-- {#if hoverStates[index]}
                            <iframe title={`Trailer for ${movie.title}`} src={`https://www.youtube.com/embed/${movie.youtube_trailer_url}?autoplay=1&controls=0&mute=1&loop=1&rel=0`}
                                id="iframe" class="w-full h-3/4 aspect-video pointer-events-none">
                            </iframe>
                        {:else} -->
                        <img src={movie.poster} alt={movie.title} class="w-full top-0 h-3/4 object-fill">
                        <!-- {/if} -->
                        <div class="flex justify-between items-center mt-2 pl-4 pr-4">
                            <div class="max-h-[48px] overflow-hidden">
                                <h2 class="text-sm md:text-base font-bold line-clamp-2">{movie.title}</h2>
                                <!-- <span class="text-xs md:text-sm line-clamp-1">{movie.type.split(',').slice(0, 2).join(' • ')}</span> -->
                            </div>
                            <button type="button" class="btn-icon variant z-50" on:click|stopPropagation={(event) => toggleBookmark(event, movie.movie_id)}>
                                {#if $bookmarkedMovies.has(movie.movie_id)}
                                    <BookmarkCheck/>
                                {:else}
                                    <Bookmark />
                                {/if}
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        </section>
    </section>
</AppShell>