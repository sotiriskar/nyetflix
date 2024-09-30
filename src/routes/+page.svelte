<script lang="ts">
    import '../app.postcss';
    import { AppShell, AppBar, Avatar, AppRail, AppRailAnchor, Autocomplete } from '@skeletonlabs/skeleton';
    import { House, Search, Library, Settings, Bookmark, BookmarkCheck, X, Play, VolumeX, Volume2 } from 'lucide-svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';

    // Highlight JS
    import hljs from 'highlight.js/lib/core';
    import 'highlight.js/styles/github-dark.css';
    import { storeHighlightJs } from '@skeletonlabs/skeleton';
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
    import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
    import { storePopup } from '@skeletonlabs/skeleton';
    storePopup.set({ computePosition, autoUpdate, flip, shift, offset, arrow });
    let currentTile = 0;

    let movies: any[] = [];
    let movieTitles: any[] = [];
    let bookmarkedMovies = new Set();

    import { onMount } from 'svelte';

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
            bookmarkedMovies = new Set(bookmarks.map((bookmark: { movie_id: any; }) => bookmark.movie_id));
        } else {
            console.error('Failed to fetch bookmarks:', bookmarkResponse.statusText);
        }
    });

    async function toggleBookmark(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }, movieId: unknown) {
        event.preventDefault();
        event.stopPropagation();

        const userId = '1'; // Replace with actual user ID
        const isCurrentlyBookmarked = bookmarkedMovies.has(movieId);

        // Update the UI immediately
        if (isCurrentlyBookmarked) {
            bookmarkedMovies.delete(movieId);
        } else {
            bookmarkedMovies.add(movieId);
        }

        // Trigger reactivity by creating a new Set
        bookmarkedMovies = new Set(bookmarkedMovies);

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
            if (isCurrentlyBookmarked) {
                bookmarkedMovies.add(movieId);
            } else {
                bookmarkedMovies.delete(movieId);
            }

            // Trigger reactivity by creating a new Set
            bookmarkedMovies = new Set(bookmarkedMovies);

            // Revert the movies array change
            movies = movies.map(movie => {
                if (movie.movie_id === movieId) {
                    return { ...movie, bookmarked: isCurrentlyBookmarked };
                }
                return movie;
            });
        }
    }

    // Hover states for each card
    let hoverStates: any[] = [];

    // Autocomplete
    let movieOptions: { label: any; value: any; }[] = [];
    let inputPopupDemo: string = '';
    let popupSettings: PopupSettings = {
        event: 'focus-click',
        target: 'popupAutocomplete',
        placement: 'bottom',
    };

    $: if (inputPopupDemo.length > 0) {
        movieOptions = movieTitles
            .filter(title => title.toLowerCase().includes(inputPopupDemo.toLowerCase()))
            .slice(0, 3)
            .map(title => ({ label: title, value: title }));
    } else {
        movieOptions = [];
    }

    function onPopupDemoSelect(event) {
        inputPopupDemo = event.detail.value;
        const selectedMovie = movies.find(movie => movie.title.toLowerCase() === inputPopupDemo.toLowerCase());
        if (selectedMovie) {
            goto(`/search?movie=${encodeURIComponent(selectedMovie.title)}`);
        }
    }

    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            goto(`/search?movie=${encodeURIComponent(inputPopupDemo.toLowerCase())}`);
        }
    }

    // Search mechanism
    let searchQuery = '';
    let filteredMovies = [];

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

    // Modal
    type Movie = {
        movie_id: number;
        title: string;
        wide_poster: string;
        poster: string;
        youtube_trailer_url: string;
        type: string;
        bookmarked?: boolean;
    };
    
    let selectedMovie: Movie | null = null;
    let muted = true;
    let iframeElement: HTMLIFrameElement | null = null;

    function openModal(movie: { movie_id: number; title: string; wide_poster: string; poster: string; youtube_trailer_url: string; type: string; bookmarked?: boolean; } | null): void {
        selectedMovie = movie;
    }

    function closeModal(): void {
        selectedMovie = null;
    }

    function handleOutsideClick() {
        closeModal();
    }

    function formatDuration(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    function toggleMute() {
        muted = !muted;
        document.getElementById("iframeId").muted = muted;
    }
</script>

<style>
    .main-content {
        margin-left: 80px; /* Adjust this value based on the actual width of your AppRail */
    }
</style>

<!-- Modal -->
{#if selectedMovie}
    <div class="modal fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto" on:click={handleOutsideClick}>
        <div class="modal-content bg-surface-800 text-surface-50 rounded-lg w-1/2 relative" role="dialog" on:click|stopPropagation>
            <button on:click={closeModal} class="absolute top-5 right-5 cursor-pointer z-10 focus:outline-0">
                <X class="text-white w-6 h-6" />
            </button>
            <div class="relative w-full h-4/5">
                <!-- <img src={selectedMovie.wide_poster} alt={selectedMovie.title} class="w-full h-full object-cover rounded-t-lg" /> -->
                <iframe bind:this={iframeElement} src={`https://www.youtube.com/embed/${selectedMovie.youtube_trailer_url}?autoplay=1&controls=0&mute=${muted ? 1 : 0}&loop=1`} class="w-full h-[400px] object-fit rounded-t-lg pointer-events-none"></iframe>
                <div class="absolute bottom-10 left-10 btn-group-vertical variant-filled">
                    <button on:click={() => goto(`/watch/${selectedMovie.movie_id}`)} class="bg-white flex items-center space-x-2 focus:outline-0">
                        <Play class="text-black" fill="#111" />
                        <span class="text-xl text-black">Play</span>
                    </button>
                </div>
                <div class="absolute bottom-8 left-[120px] mt-4 pl-10">
                    <button type="button" class="focus:outline-0" on:click={(event) => toggleBookmark(event, selectedMovie.movie_id)}>
                        {#if bookmarkedMovies.has(selectedMovie.movie_id)}
                            <BookmarkCheck stroke="black" class="w-12 h-12 pb-1"/>
                        {:else}
                            <Bookmark class="w-12 h-12 pb-1"/>
                        {/if}
                    </button>
                </div>
                <div class="absolute bottom-10 right-10 btn">
                    <button type="button" class="btn p-1.5 border-2 focus:outline-0" on:click={toggleMute}>
                        {#if muted}
                            <VolumeX class="w-6 h-6"/>
                        {:else}
                            <Volume2 class="w-6 h-6"/>
                        {/if}
                    </button>
                </div>
            </div>
            <div class="text-white w-full p-8 flex gap-5">
                <div class="left-content w-full">
                    <div class="description-container">
                        <span class="text-sm break-words">{selectedMovie.description}</span>
                    </div>
                </div>
                <div class="right-content w-full">
                    <ul class="list-none space-y-4 float-right">
                        <li class="text-sm">
                            <span><span class="text-surface-400">Genres:</span> {selectedMovie.type}</span>
                        </li>
                        <li class="text-sm">
                            <span><span class="text-surface-400">IMDB Rating:</span> {selectedMovie.rating}</span>
                        </li>
                        <li class="text-sm">
                            <span><span class="text-surface-400">Duration:</span> {formatDuration(selectedMovie.duration)}</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- App Shell -->
<AppShell>
    <svelte:fragment slot="header">
        <!-- App Bar -->
        <AppBar gridColumns="grid-cols-3" slotDefault="place-self-center" slotTrail="place-content-end">
            <svelte:fragment slot="lead">
                <a href="/" class="focus:outline-0">
                    <img src="/nyetflix-logo.png" alt="Nyetflix Logo" class="h-10 pl-4"/>
                  </a>
            </svelte:fragment>
                <input
                    class="input autocomplete"
                    type="search"
                    name="autocomplete-search"
                    bind:value={inputPopupDemo}
                    placeholder="Search..."
                    use:popup={popupSettings}
                    on:keypress={handleKeyPress}
                />
                <div data-popup="popupAutocomplete">
                    <Autocomplete
                        class="bg-surface-800 text-surface-50 rounded-md shadow-md p-4"
                        bind:input={inputPopupDemo}
                        options={movieOptions}
                        on:selection={onPopupDemoSelect}
                    />
                </div>
            <svelte:fragment slot="trail">
                <Avatar initials="SK" background="bg-primary-500" class="h-9 w-9 mr-2" />
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>
    <!-- Flex Container -->
    <section class="flex w-full h-full">
        <!-- App Rail -->
        <AppRail class="flex flex-col items-center justify-center pb-40 fixed">
            <AppRailAnchor selected={$page.url.pathname === '/'} name="home" title="Home" href="/">
                <svelte:fragment slot="lead">
                    <House class="w-20"/>
                </svelte:fragment>
            </AppRailAnchor>
            <AppRailAnchor selected={$page.url.pathname === '/discover'} name="search" title="Search" href="/discover">
                <svelte:fragment slot="lead">
                    <Search class="w-20"/>
                </svelte:fragment>
            </AppRailAnchor>
            <AppRailAnchor selected={$page.url.pathname === '/library'} name="library" title="Library" href="/library">
                <svelte:fragment slot="lead">
                    <Library class="w-20"/>
                </svelte:fragment>
            </AppRailAnchor>
            <AppRailAnchor bind:group={currentTile} name="settings" value={3} title="Settings">
                <svelte:fragment slot="lead">
                    <Settings class="w-20"/>
                </svelte:fragment>
            </AppRailAnchor>
        </AppRail>
        <!-- Movies Grid -->
        <section class="pl-10 pr-10 pt-10 flex-grow main-content">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {#each movies as movie, index}
                    <a class="card w-full h-[380px] rounded-lg transform hover:scale-[115%] transition-transform duration-300 relative hover:z-10"
                        href=""
                        role="button"
                        on:click={() => openModal(movie)}
                        on:keydown={(event) => event.key === 'Enter' && openModal(movie)}
                        on:mouseenter={() => hoverStates[index] = true}
                        on:mouseleave={() => hoverStates[index] = false}>
                        {#if hoverStates[index]}
                            <iframe title={`Trailer for ${movie.title}`} src={`https://www.youtube.com/embed/${movie.youtube_trailer_url}?autoplay=1&controls=0&mute=1&loop=1&rel=0`} class="w-full h-3/4 object-cover rounded-t-lg pointer-events-none"></iframe>
                        {:else}
                            <img src={movie.poster} alt={movie.title} class="w-full top-0 h-3/4 object-cover rounded-t-lg">
                        {/if}
                        <div class="flex justify-between items-center mt-2 pl-4 pr-4">
                            <div>
                                <h2 class="text-xl font-bold">{movie.title}</h2>
                                <span class="text-s">{movie.type.split(',').slice(0, 2).join(' • ')}</span>
                            </div>
                            <button type="button" class="btn-icon variant" on:click={(event) => toggleBookmark(event, movie.movie_id)}>
                                {#if bookmarkedMovies.has(movie.movie_id)}
                                    <BookmarkCheck/>
                                {:else}
                                    <Bookmark />
                                {/if}
                            </button>
                        </div>
                    </a>
                {/each}
            </div>
        </section>
    </section>
</AppShell>
