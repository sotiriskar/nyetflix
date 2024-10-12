<script lang="ts">
    import '../../app.postcss';
    import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
    import { AppShell, storeHighlightJs, storePopup } from '@skeletonlabs/skeleton';
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
    let bookmarkedMoviesList: any[] = [];
    let currentTile: number = 0;
    let movieTitles: any[] = [];
    let hoverStates: any[] = [];
    let movies: any[] = [];
    let modal: Modal;
    let userData: any = null;
    let initials: string = '';

    function getInitials(username: string): string {
        return username.split(' ').map(name => name[0]).join('');
    }

    onMount(async () => {
        try {
            const response = await fetch('/api/user/');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    userData = data[0];
                    if (userData.username) {
                        initials = getInitials(userData.username);
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
        bookmarkedMovies.subscribe(set => {
            bookmarkedMoviesList = movies.filter(movie => set.has(movie.movie_id));
        });
    }

    function openModal(movie: { movie_id: number; title: string; backdrop: string; poster: string; youtube_trailer_url: string; type: string; bookmarked?: boolean; description?: string; rating?: number; duration?: number; } | null) {
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
            <div class="grid grid-cols-2 md:grid-cols-7 gap-4 mb-10">
                {#each bookmarkedMoviesList as movie, index}
                    <div class="card w-full h-[360px] overflow-hidden transform hover:brightness-110 hover:scale-y-[115%] hover:scale-x-[115%] transition-transform duration-300 relative hover:z-10"
                        role="button"
                        tabindex="0"
                        on:click={() => openModal(movie)}
                        on:keydown={(event) => event.key === 'Enter' && openModal(movie)}
                        on:mouseenter={() => hoverStates[index] = true}
                        on:mouseleave={() => hoverStates[index] = false}>
                        <img src={movie.poster} alt={movie.title} class="w-full top-0 h-full object-cover">
                    </div>
                {/each}
            </div>
        </section>
    </section>
</AppShell>