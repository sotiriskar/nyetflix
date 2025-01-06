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
	import { Library } from 'lucide-svelte';

    hljs.registerLanguage('xml', xml); // for HTML
    hljs.registerLanguage('css', css);
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('typescript', typescript);
    storeHighlightJs.set(hljs);

    // Floating UI for Popups
    storePopup.set({ computePosition, autoUpdate, flip, shift, offset, arrow });

    interface Movie {
        title: string;
        year: number;
        type: string;
        backdrop: string;
        duration: number;
        rating: number;
        description: string;
        movie_id: number;
        poster: string;
        youtube_trailer_url: string;
    }

    let movieYears: Iterable<any> | ArrayLike<any> = [];
    let selectedMovie: Movie | null = null;
    let genres: Iterable<any> | ArrayLike<any> = [];

    let selectedGenre = 'all';
    let selectedYear = 'all';
    let selectedOrder = 'none';

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
            movieTitles = bookmarkedMoviesList.map(movie => movie.title);
            movieYears = [...new Set(bookmarkedMoviesList.map(movie => movie.year))];
            genres = [...new Set(bookmarkedMoviesList.flatMap(movie => movie.type.split(',')))];
        });
    }

    function openModal(movie: { movie_id: number; title: string; backdrop: string; poster: string; youtube_trailer_url: string; type: string; bookmarked?: boolean; description?: string; rating?: number; duration?: number; } | null) {
        modal.openModal(movie);
    }

    function sortMovies(movies: Movie[], order: string): Movie[] {
        if (order === 'none') {
            return movies;
        }
        return movies.slice().sort((a, b) => {
            if (order === 'rating') {
                return b.rating - a.rating;
            } else if (order === 'date') {
                return b.year - a.year;
            } else if (order === 'duration') {
                return b.duration - a.duration;
            }
            return 0;
        });
    }

    $: filteredMovies = sortMovies(bookmarkedMoviesList.filter(movie => {
        const matchesGenre = selectedGenre === 'all' || movie.type.split(',').includes(selectedGenre);
        const matchesYear = selectedYear === 'all' || movie.year === Number(selectedYear);
        return matchesGenre && matchesYear;
    }), selectedOrder);

    $: if (filteredMovies.length > 0) {
        selectedMovie = filteredMovies[0];
    }
</script>

<style>
    select {
        background-color: #111823;
        color: white;
        border: 1px solid #4B5563;
    }

    select option {
        background-color: #111823;
        color: white;
    }

    select > option:focus { 
        background: #000 !important;
    }
</style>

<!-- Modal Component -->
<Modal
    bind:this={modal}
    {movies}
    {bookmarkedMovies}
/>

<svelte:head>
    <title>Nyetflix - Library</title>
</svelte:head>

<!-- App Shell -->
<AppShell>
    <svelte:fragment slot="header">
        <TopBar {movies} {movieTitles} />
    </svelte:fragment>
    <!-- Flex Container -->
    <section class="flex w-full h-full bg-[#111823]">
        <!-- NavBar Component -->
        <NavBar bind:currentTile={currentTile} />
        <!-- Movies Grid -->
        <section class="px-10 pb-10 pt-10 flex-grow main-content md:px-[12vw] mx-auto">
            <section class="pt-10 pb-10">
                <div class="flex flex-row items-start space-y-0 space-x-4">
                  <div class="flex-1 min-w-[100px] max-w-[250px]">
                    <h2 class="text-2xl font-bold">Genres</h2>
                    <select class="select mt-2 p-2 text-lg w-full" bind:value={selectedGenre}>
                      <option value="all">All</option>
                      {#each Array.from(genres) as genre}
                        <option value={genre}>{genre}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="flex-1 min-w-[100px] max-w-[250px]">
                    <h2 class="text-2xl font-bold">Date</h2>
                    <select class="select mt-2 p-2 text-lg w-full" bind:value={selectedYear}>
                      <option value="all">All</option>
                      {#each Array.from(movieYears) as movieYear}
                        <option value={movieYear}>{movieYear}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="flex-1 min-w-[100px] max-w-[250px]">
                    <h2 class="text-2xl font-bold">Order By</h2>
                    <select class="select mt-2 p-2 text-lg w-full" bind:value={selectedOrder}>
                      <option value="none">None</option>
                      <option value="rating">Rating</option>
                      <option value="date">Date</option>
                      <option value="duration">Duration</option>
                    </select>
                  </div>
                </div>
              </section>
              <div class="grid grid-cols-3 md:grid-cols-7 gap-4 mb-10">
                {#if movies.length === 0}
                {#each Array(1) as _, i}
                    <div class="card !bg-[#3f4756] w-full h-0 pt-[140%] overflow-hidden transform hover:brightness-110 rounded-lg transition-transform duration-300 relative placeholder animate-pulse" style="max-height: 350px; max-width: 233px;"/>
                {/each}
                {:else}
                    {#each filteredMovies as movie, index}
                        <div class="card !bg-[#3f4756] w-full h-full overflow-hidden transform brightness-[85%] hover:brightness-100 hover:scale-y-[115%] hover:scale-x-[115%] transition-transform duration-300 relative hover:z-10"
                            role="button"
                            tabindex="0"
                            on:click={() => openModal(movie)}
                            on:keydown={(event) => event.key === 'Enter' && openModal(movie)}
                            on:mouseenter={() => hoverStates[index] = true}
                            on:mouseleave={() => hoverStates[index] = false}>
                            <img src={movie.poster} alt={movie.title} class="w-full top-0 h-full object-cover">
                        </div>
                    {/each}
                {/if}
            </div>
        </section>
    </section>
</AppShell>