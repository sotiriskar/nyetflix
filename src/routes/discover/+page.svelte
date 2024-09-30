<script lang="ts">
    import '../../app.postcss';
    import { AppShell } from '@skeletonlabs/skeleton';
    import { ChevronLeft, ChevronRight, Play } from 'lucide-svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import TopBar from '$lib/components/TopBar.svelte';
    import NavBar from '$lib/components/NavBar.svelte';

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
    
    let movies: Movie[] = [];
    let movieTitles: string[] = [];
    let movieYears: Iterable<any> | ArrayLike<any> = [];
    let selectedMovie: Movie | null = null;
    let genres: Iterable<any> | ArrayLike<any> = [];

    let selectedGenre = 'all';
    let selectedYear = 'all';

    import { onMount } from 'svelte';

    onMount(async () => {
        const response = await fetch('/api/movies');
        if (response.ok) {
            movies = await response.json();
            movieTitles = movies.map(movie => movie.title);
            movieYears = [...new Set(movies.map(movie => movie.year))];
            selectedMovie = movies[0]; // Set the initial selected movie
            genres = [...new Set(movies.flatMap(movie => movie.type.split(',')))];

            // Debugging: Log the genres set
            console.log('Extracted genres:', Array.from(genres));
        } else {
            console.error('Failed to fetch movies:', response.statusText);
        }
    });

    // Search mechanism
    let searchQuery = '';
    let filteredMovies: string | any[] = [];

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
            filteredMovies = [];
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

    function selectMovie(movie: Movie) {
        selectedMovie = movie;
    }

    function playSelectedMovie() {
        if (selectedMovie) {
            goto(`/watch/${selectedMovie.movie_id}`);
        }
    }

    $: filteredMovies = movies.filter(movie => {
        const matchesGenre = selectedGenre === 'all' || movie.type.split(',').includes(selectedGenre);
        const matchesYear = selectedYear === 'all' || movie.year === Number(selectedYear);
        return matchesGenre && matchesYear;
    });

    $: if (filteredMovies.length > 0) {
        selectedMovie = filteredMovies[0];
    }
</script>

<style>
    .main-content {
        margin-left: 80px; /* Adjust this value based on the actual width of your AppRail */
    }
</style>

<!-- App Shell -->
<AppShell>
    <svelte:fragment slot="header">
        <TopBar {movies} {movieTitles} />
    </svelte:fragment>
    <!-- Flex Container -->
    <section class="flex w-full h-full">
        <!-- NavBar Component -->
        <NavBar bind:currentTile={currentTile} />
        <section class="pl-10 pr-10 pt-10 flex-grow main-content">
            {#if selectedMovie}
                <div class="relative w-full h-96">
                    <img src={selectedMovie.wide_poster} alt={selectedMovie.title} class="w-full h-full object-cover object-top rounded-lg">
                    <div class="absolute inset-0 bg-gradient-to-r from-surface-900 to-transparent via-surface-900/90 via-40% to-70% rounded-lg"></div>
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
            <section class="pt-10 pl-14">
                <h2 class="text-2xl font-bold">Genres</h2>
                <div class="grid grid-cols-4 gap-4 pt-4">
                    <select class="select" bind:value={selectedGenre}>
                        <option value="all">All</option>
                        {#each Array.from(genres) as genre}
                            <option value={genre}>{genre}</option>
                        {/each}
                    </select>
                    <select class="select" bind:value={selectedYear}>
                        <option value="all">All</option>
                        {#each Array.from(movieYears) as movieYear}
                            <option value={movieYear}>{movieYear}</option>
                        {/each}
                    </select>
                </div>
            </section>
            <!-- Movies Carousel -->
            <section class="pt-10">
                <div class="grid grid-cols-[auto_1fr_auto] gap-4 items-center">
                    <!-- Button: Left -->
                    <button type="button" class="btn-icon border" on:click={multiColumnLeft}>
                        <ChevronLeft class="white transition-transform transform hover:scale-[115%]" />
                    </button>
                    <!-- Carousel -->
                    <div bind:this={elemMovies} class="snap-x snap-mandatory scroll-smooth flex gap-2 pb-2 overflow-x-auto">
                        {#each filteredMovies as movie}
                            <button type="button" on:click={() => selectMovie(movie)} on:keydown={(e) => e.key === 'Enter' && selectMovie(movie)} class="shrink-0 w-[18%] snap-start cursor-pointer" aria-label={`Select ${movie.title}`}>
                                <img src={movie.poster} alt={movie.title} class="w-full h-full object-cover rounded-t-lg">
                            </button>
                        {/each}
                    </div>
                    <!-- Button-Right -->
                    <button type="button" class="btn-icon border" on:click={multiColumnRight}>
                        <ChevronRight class="white transition-transform transform hover:scale-[115%]" />
                    </button>
                </div>
            </section>
        </section>
    </section>
</AppShell>