<script lang="ts">
    import '../../app.postcss';
    import { AppShell } from '@skeletonlabs/skeleton';
    import { ChevronLeft, ChevronRight, Play } from 'lucide-svelte';
    import TopBar from '$lib/components/TopBar.svelte';
    import NavBar from '$lib/components/NavBar.svelte';
    import Modal from '$lib/components/Modal.svelte';
    import { Bookmark, BookmarkCheck } from 'lucide-svelte';
    import { writable } from 'svelte/store';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

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
        backdrop: string;
        duration: number;
        rating: string;
        description: string;
        movie_id: string;
        poster: string;
    }

    let bookmarkedMovies = writable<Set<number>>(new Set());
    let movies: Movie[] = [];
    let movieTitles: string[] = [];
    let hoverStates: any[] = [];
    let movieYears: Iterable<any> | ArrayLike<any> = [];
    let selectedMovie: Movie | null = null;
    let genres: Iterable<any> | ArrayLike<any> = [];
    let userData: any = null;
    let modal: Modal;

    let selectedGenre = 'all';
    let selectedYear = 'all';
    let selectedOrder = 'none';

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

        const response = await fetch('/api/movies');
        if (response.ok) {
            movies = await response.json();
            movieTitles = movies.map(movie => movie.title);
            movieYears = [...new Set(movies.map(movie => movie.year))];
            selectedMovie = movies[0]; // Set the initial selected movie
            genres = [...new Set(movies.flatMap(movie => movie.type.split(',')))];
        } else {
            console.error('Failed to fetch movies:', response.statusText);
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

    function openModal(movie: { movie_id: number; title: string; backdrop: string; poster: string; youtube_trailer_url: string; type: string; bookmarked?: boolean; description?: string; rating?: number; duration?: number; } | null) {
        modal.openModal(movie);
    }

    function sortMovies(movies: Movie[], order: string): Movie[] {
        if (order === 'none') {
            return movies;
        }
        return movies.slice().sort((a, b) => {
            if (order === 'rating') {
                return b.rating.localeCompare(a.rating);
            } else if (order === 'date') {
                return b.year - a.year;
            } else if (order === 'duration') {
                return b.duration - a.duration;
            }
            return 0;
        });
    }

    $: filteredMovies = sortMovies(movies.filter(movie => {
        const matchesGenre = selectedGenre === 'all' || movie.type.split(',').includes(selectedGenre);
        const matchesYear = selectedYear === 'all' || movie.year === Number(selectedYear);
        return matchesGenre && matchesYear;
    }), selectedOrder);

    $: if (filteredMovies.length > 0) {
        selectedMovie = filteredMovies[0];
    }

    // async function toggleBookmark(event: MouseEvent, movieId: number) {
    //     event.preventDefault();
    //     event.stopPropagation();

    //     if (!userData || !userData.user_id) {
    //         console.error('User ID not found in userData');
    //         return;
    //     }

    //     let isCurrentlyBookmarked: boolean = false;
    //     bookmarkedMovies.update(set => {
    //         isCurrentlyBookmarked = set.has(movieId);
    //         if (isCurrentlyBookmarked) {
    //             set.delete(movieId);
    //         } else {
    //             set.add(movieId);
    //         }
    //         return new Set(set);
    //     });

    //     // Update the movies array to trigger reactivity
    //     movies = movies.map(movie => {
    //         if (movie.movie_id === String(movieId)) {
    //             return { ...movie, bookmarked: !isCurrentlyBookmarked };
    //         }
    //         return movie;
    //     });

    //     try {
    //         if (isCurrentlyBookmarked) {
    //             // Remove bookmark
    //             await fetch(`/api/user/${userData.user_id}/bookmark`, {
    //                 method: 'DELETE',
    //                 headers: { 'Content-Type': 'application/json' },
    //                 body: JSON.stringify({ movie_id: movieId })
    //             });
    //         } else {
    //             // Add bookmark
    //             await fetch(`/api/user/${userData.user_id}/bookmark`, {
    //                 method: 'POST',
    //                 headers: { 'Content-Type': 'application/json' },
    //                 body: JSON.stringify({ movie_id: movieId })
    //             });
    //         }
    //     } catch (err) {
    //         console.error('Failed to toggle bookmark:', err);
    //         // Revert the UI change if the API call fails
    //         bookmarkedMovies.update(set => {
    //             if (isCurrentlyBookmarked) {
    //                 set.add(movieId);
    //             } else {
    //                 set.delete(movieId);
    //             }
    //             return new Set(set);
    //         });

    //         // Revert the movies array change
    //         movies = movies.map(movie => {
    //             if (movie.movie_id === String(movieId)) {
    //                 return { ...movie, bookmarked: isCurrentlyBookmarked };
    //             }
    //             return movie;
    //         });
    //     }
    // }
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
        <section class="pl-10 pr-10 pt-10 flex-grow main-content">
            <section class="pt-10 pl-14">
                <div class="flex items-center space-x-8">
                    <div>
                        <h2 class="text-2xl font-bold">Genres</h2>
                        <select class="select mt-2 p-2 text-lg w-48" bind:value={selectedGenre}>
                            <option value="all">All</option>
                            {#each Array.from(genres) as genre}
                                <option value={genre}>{genre}</option>
                            {/each}
                        </select>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold">Date</h2>
                        <select class="select mt-2 p-2 text-lg w-48" bind:value={selectedYear}>
                            <option value="all">All</option>
                            {#each Array.from(movieYears) as movieYear}
                                <option value={movieYear}>{movieYear}</option>
                            {/each}
                        </select>
                    </div>
                    <div>
                        <h2 class="text-2xl font-bold">Order By</h2>
                        <select class="select mt-2 p-2 text-lg w-48" bind:value={selectedOrder}>
                            <option value="none">None</option>
                            <option value="rating">Rating</option>
                            <option value="date">Date</option>
                            <option value="duration">Duration</option>
                        </select>
                    </div>
                </div>
            </section>
            <section class="pt-10">
                <div class="grid grid-cols-2 md:grid-cols-7 gap-4 mb-10">
                    {#if filteredMovies.length === 0}
                        {#each Array(14) as _, i}
                            <div class="card w-full h-[360px] overflow-hidden transform rounded-lg hover:brightness-110 transition-transform duration-300 relative placeholder animate-pulse" />
                        {/each}
                    {:else}
                        {#each filteredMovies as movie, index}
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
                    {/if}
                </div>
            </section>
        </section>
    </section>
</AppShell>