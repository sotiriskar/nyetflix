<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { CirclePlus , CircleX, X, Play, VolumeX, Volume2 } from 'lucide-svelte';
    import { goto } from '$app/navigation';
    import { writable } from 'svelte/store';

    export let movies: any[] = [];
    export let bookmarkedMovies = writable(new Set());

    let selectedMovie: {
        movie_id: number;
        title: string;
        backdrop: string;
        poster: string;
        youtube_trailer_url: string;
        type: string;
        bookmarked?: boolean;
        description?: string;
        rating?: number;
        duration?: number;
    } | null = null;

    let muted = true;
    let iframeElement: HTMLIFrameElement | null = null;

    const dispatch = createEventDispatcher();

    export function openModal(movie: typeof selectedMovie): void {
        selectedMovie = movie;
    }

    function closeModal(): void {
        selectedMovie = null;
    }

    function handleOutsideClick() {
        closeModal();
    }

    function toggleMute() {
        muted = !muted;
    }

    async function toggleBookmark(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }, movieId: number) {
        event.preventDefault();
        event.stopPropagation();

        const userId = '1'; // Replace with actual user ID
        let isCurrentlyBookmarked = false;
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
                await fetch(`/api/user/${userId}/bookmark`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ movie_id: movieId })
                });
            } else {
                // Add bookmark
                await fetch(`/api/user/${userId}/bookmark`, {
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
</script>

{#if selectedMovie}
    <div class="modal fixed inset-0 z-50 min-w-[318px] flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto" on:click={handleOutsideClick}>
        <div class="modal-content rounded-lg bg-surface-800 text-surface-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto relative mx-4 sm:mx-6 lg:mx-8" role="dialog" on:click|stopPropagation>
            <button on:click={closeModal} class="absolute top-5 right-5 cursor-pointer z-10 focus:outline-0">
                <X class="text-white w-6 h-6" />
            </button>
            <div class="relative w-full h-[40vh] sm:h-[50vh] lg:h-[60vh] overflow-hidden rounded-t-lg">
                <div class="w-full h-full scale-[150%] rounded-none overflow-hidden">
                    <iframe bind:this={iframeElement} src={`https://www.youtube.com/embed/${selectedMovie.youtube_trailer_url}?autoplay=1&controls=0&mute=${muted ? 1 : 0}&loop=1`} class="w-full h-full object-cover pointer-events-none"></iframe>
                </div>
                <div class="absolute bottom-[40px] left-10 flex flex-wrap gap-4 items-center">
                    <button on:click={() => goto(`/watch/${selectedMovie.movie_id}`)} class="px-6 py-2 rounded-lg variant-filled bg-gray-200 hover:bg-gray-300 flex items-center text-sm sm:text-base">
                        <Play class="text-black" fill="#111" />
                        <span class="text-black ml-2">Play</span>
                    </button>
                    <button type="button" class="focus:outline-0" on:click={(event) => toggleBookmark(event, selectedMovie.movie_id)}>
                        {#if $bookmarkedMovies.has(selectedMovie.movie_id)}
                            <CircleX strokeWidth={1} class="w-11 h-11"/>
                        {:else}
                            <CirclePlus strokeWidth={1} class="w-11 h-11"/>
                        {/if}
                    </button>
                </div>
                <div class="absolute bottom-[41px] right-10">
                    <button type="button" class="btn p-1.5 border-[2px] focus:outline-0 border-color border-gray-300" on:click={toggleMute}>
                        {#if muted}
                            <VolumeX strokeWidth={1.5} class="w-6 h-6"/>
                        {:else}
                            <Volume2 strokeWidth={1.5} class="w-6 h-6"/>
                        {/if}
                    </button>
                </div>
            </div>
            <div class="text-white w-full max-h-[30vh] py-10 px-6 sm:px-6 lg:px-8 flex flex-col sm:flex-row overflow-y-auto scrollbar-hidden">
                <div class="left-content w-full ml-2 mb-2">
                    <div class="description-container">
                        <span class="text-sm break-words">{selectedMovie.description}</span>
                    </div>
                </div>
                <div class="right-content w-full mr-2">
                    <ul class="list-none space-y-4 sm:float-right float-left">
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
