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

    let userData: { user_id?: string } = {};

    onMount(async () => {
        try {
            const response = await fetch('/api/user/');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    userData = data[0];
                    if (userData.user_id) {
                    } else {
                        console.error('user_id is undefined');
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

        const response = await fetch('/api/movies');
        if (response.ok) {
            movies = await response.json();
            movieTitles = movies.map(movie => movie.title);
        } else {
            console.error('Failed to fetch movies:', response.statusText);
        }

        const bookmarkResponse = await fetch(`/api/user/${userData.user_id}/bookmark`);
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
        <section class="pl-14 pr-10 pt-10 flex-grow main-content">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
                {#if filteredMovies.length > 0}
                    {#each filteredMovies as movie, index}
                        <div class="card w-full h-[300px] overflow-hidden transform hover:brightness-110 hover:scale-y-[115%] hover:scale-x-[115%] transition-transform duration-300 relative hover:z-10"
                            role="button"
                            tabindex="0"
                            on:click={() => openModal(movie)}
                            on:keydown={(event) => event.key === 'Enter' && openModal(movie)}
                            on:mouseenter={() => hoverStates[index] = true}
                            on:mouseleave={() => hoverStates[index] = false}>
                            <img src={movie.poster} alt={movie.title} class="w-full top-0 h-full object-cover">
                        </div>
                    {/each}
                {:else}
                    <p>No movies found for "{searchQuery}".</p>
                {/if}
            </div>
        </section>
    </section>
</AppShell>
