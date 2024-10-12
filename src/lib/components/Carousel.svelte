<script lang="ts">
  import { ChevronLeft, ChevronRight, CirclePlay, CircleChevronDown, CircleX, CirclePlus } from 'lucide-svelte';
  import { writable, type Writable } from 'svelte/store';
  import { defineCustomElements } from '@vime/core/loader';
  import * as pkg from '@vime/core';

  const { VmYoutube, VmPlayer, VmEmbed, VmVideo } = pkg;
  defineCustomElements();

  export let bookmarkedMovies: Writable<Set<number>> = writable(new Set());
  export let title: string;
  export let userData: { user_id: number } | null;
  export let movies: string | any[] = [];
  export let playSelectedMovie;
  export let openModal;

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
      movies = Array.isArray(movies) ? movies.map(movie => {
          if (movie.movie_id === movieId) {
              return { ...movie, bookmarked: !isCurrentlyBookmarked };
          }
          return movie;
      }) : movies;

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
          movies = Array.isArray(movies) ? movies.map(movie => {
              if (movie.movie_id === movieId) {
                  return { ...movie, bookmarked: isCurrentlyBookmarked };
              }
              return movie;
          }) : movies;
      }
  }

  let hoverStates = new Array(movies.length).fill(false);
  let elemMovies: HTMLDivElement;

  function multiColumnLeft(): void {
    let x = elemMovies.scrollWidth;
    if (elemMovies.scrollLeft !== 0) x = elemMovies.scrollLeft - elemMovies.clientWidth;
    elemMovies.scroll(x, 0);
  }

  function multiColumnRight(): void {
    let x = 0;
    if (elemMovies.scrollLeft < elemMovies.scrollWidth - elemMovies.clientWidth - 1) x = elemMovies.scrollLeft + elemMovies.clientWidth;
    elemMovies.scroll(x, 0);
  }
</script>

<style>
    /* Hide scrollbar for Chrome, Safari and Opera */
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge and Firefox */
  .hide-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
</style>

<link
rel="stylesheet"
href="https://cdn.jsdelivr.net/npm/@vime/core@^5/themes/default.css"
/>

<section class="overflow-visible">
  <h2 class="text-2xl font-bold w-full pl-[100px] relative top-14">{title}</h2>
  <div class="relative flex items-center">
    <!-- Button: Left -->
    <button type="button" class="w-20 h-40 z-10" on:click={multiColumnLeft}>
      <ChevronLeft class="white transition-transform transform hover:scale-[115%] w-full h-full" />
    </button>
    <!-- Carousel -->
    <div bind:this={elemMovies} class=" hide-scrollbar relative pt-20 pb-20 snap-x snap-mandatory scroll-smooth flex gap-2 overflow-x-auto  overflow-y-visible flex-grow pl-20">
      {#each movies as movie, index}
      <button type="button" class="card shrink-0 h-[170px] md:w-[22%] snap-start transform hover:scale-y-[200%] hover:scale-x-[130%] transition-transform duration-300 relative hover:z-10 rounded-lg hide-scrollbar" aria-label={`Select ${movie.title}`}
        on:keydown={(event) => event.key === 'Enter' && openModal(movie)}
        on:mouseenter={() => hoverStates[index] = true}
        on:mouseleave={() => hoverStates[index] = false}>
        {#if hoverStates[index]}
        <div class="overflow-hidden w-full h-full relative flex flex-col hide-scrollbar rounded-lg">
          <button class="h-4/6 relative overflow-hidden hide-scrollbar" on:click={() => openModal(movie)}>
            <div class="scale-x-[200%] scale-y-[200%] origin-center w-full h-full">
              <iframe title={`Trailer for ${movie.title}`} src={`https://www.youtube.com/embed/${movie.youtube_trailer_url}?autoplay=1&controls=0&mute=1&loop=1&rel=0`}
                id="iframe" class="absolute top-0 left-0 w-full h-full object-fill pointer-events-none hide-scrollbar">
              </iframe>
            </div>
          </button>
          <div class="scale-x-[150%] h-1/6 w-full flex px-[55px] justify-between items-center overflow-visible hide-scrollbar">
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
          <div class="scale-x-[150%] h-2/7 w-full flex justify-start pl-[70px] pb-2 overflow-hidden hide-scrollbar">
            <span class="text-[10px]">{movie.type.split(',').slice(0, 2).join(' • ')}</span>
          </div>
        </div>
      {:else}
        <div class="w-full h-full object-cover relative">
          <img src={movie.backdrop} alt={movie.title} class="w-full h-full object-cover rounded-lg">
          <img src={movie.logo} alt={movie.title} class="w-[40%] h-[30%] object-contain rounded-lg absolute bottom-4 left-4">
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