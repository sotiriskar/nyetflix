<script lang="ts">
    import { ChevronLeft, ChevronRight, Play, ChevronDown, X, Plus } from 'lucide-svelte';
    import { writable, type Writable } from 'svelte/store';
    import { defineCustomElements } from '@vime/core/loader';
    import * as pkg from '@vime/core';
  
    const { VmYoutube, VmPlayer, VmEmbed, VmVideo } = pkg;
    defineCustomElements();
  
    export let bookmarkedMovies: Writable<Set<number>> = writable(new Set());
    export let title: string;
    export let lastSeen: { id: number, movie_id: number, user_id: number, last_seen: number }[];
    export let userData: { user_id: number } | null;
    export let movies: string | any[] = [];
    export let playSelectedMovie;
    export let openModal;
  
    // Filter lastSeen to keep only unique movie_id
    lastSeen = Array.from(new Map(lastSeen.map(item => [item.movie_id, item])).values());
  
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

    // Reactive statement to update seen_movies whenever movies or lastSeen change
    $: seen_movies = Array.isArray(movies) ? movies.filter(movie => lastSeen.some(seen => seen.movie_id === movie.movie_id)) : [];

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
  
  <section class="overflow-visible bg-[#111823]">
    <h2 class="text-2xl font-bold w-full pl-[100px] relative top-14">{title}</h2>
    <div class="relative flex items-center">
      <!-- Button: Left -->
      <button type="button" class="mx-2 min-w-[50px] h-[170px] py-[55px] rounded-l-lg bg-black bg-opacity-20 hover:bg-opacity-30 z-10" on:click={multiColumnLeft}>
        <ChevronLeft class="white transition-transform transform hover:scale-[115%]  w-full h-full" />
      </button>
      <!-- Carousel or Placeholder -->
      <div bind:this={elemMovies} class="hide-scrollbar relative pt-20 pb-20 snap-x snap-mandatory scroll-smooth flex gap-2 overflow-x-auto overflow-y-visible flex-grow">
        {#if movies.length === 0}
            {#each Array(5) as _, i}
            <div class="card !bg-[#3f4756] shrink-0 h-[170px] w-[22%] snap-start transform transition-transform duration-300 relative hover:brightness-110 rounded-lg hide-scrollbarplaceholder animate-pulse" />
            {/each}
        {:else}  
            {#each seen_movies as movie, index}
                <button type="button" class="card shrink-0 h-[170px] w-full xs:w-[85%] sm:w-[40%] md:w-[40%] lg:w-[28%] xl:w-[18%] snap-start transform hover:scale-y-[190%] hover:scale-x-[120%] transition-transform duration-300 relative hover:z-10 shadow-md rounded-lg hide-scrollbar hover:ml-7" aria-label={`Select ${movie.title}`}
                on:keydown={(event) => event.key === 'Enter' && openModal(movie)}
                on:mouseenter={() => hoverStates[index] = true}
                on:mouseleave={() => hoverStates[index] = false}>
                {#if hoverStates[index]}
                    <div class="bg-[#111823] overflow-hidden w-full h-full relative flex flex-col hide-scrollbar rounded-lg">
                    <button class="h-4/6 relative overflow-hidden hide-scrollbar" on:click={() => openModal(movie)}>
                        <div class="scale-x-[200%] scale-y-[200%] origin-center w-full h-full">
                        <iframe title={`Trailer for ${movie.title}`} src={`https://www.youtube.com/embed/${movie.youtube_trailer_url}?autoplay=1&controls=0&mute=1&loop=1&rel=0`}
                            id="iframe" class="absolute top-0 left-0 w-full h-full object-fill pointer-events-none hide-scrollbar">
                        </iframe>
                        </div>
                    </button>
                    <div class="my-1 px-4 h-1/6 w-full flex justify-between items-center border-slate-200">
                        <div class="flex space-x-2">
                        <button 
                            type="button" 
                            class="scale-x-[150%] z-10 mr-2 w-[22px] h-[22px] p-1 flex items-center justify-center rounded-full border border-white hover:bg-[#ff4654] transition-transform" 
                            on:click={() => playSelectedMovie(movie)}
                        >
                            <Play strokeWidth={1} class="fill-white"/>
                        </button>
                        <div class="flex space-x-2">
                            <button 
                            type="button" 
                            class="scale-x-[150%] z-10 w-[22px] h-[22px] p-1 flex items-center justify-center rounded-full border border-white hover:bg-white hover:bg-opacity-25 transition-transform" 
                            on:click={(event) => toggleBookmark(event, movie.movie_id)}>
                            {#if $bookmarkedMovies.has(movie.movie_id)}
                                <X strokeWidth={2}/>
                            {:else}
                                <Plus strokeWidth={2}/>
                            {/if}
                            </button>
                        </div>
                        </div>
                        <div class="flex space-x-2">
                        <button 
                            type="button" 
                            class="scale-x-[150%] z-10 w-[22px] h-[22px] flex items-center justify-center rounded-full border border-white hover:bg-white hover:bg-opacity-25 transition-transform" 
                            on:click={() => openModal(movie)}
                        >
                            <ChevronDown strokeWidth={1.3} class="mt-0.5"/>
                        </button>
                        </div>
                    </div>
                    <div class="px-8 sm:px-8 md:px-8 h-2/7 w-full flex justify-start pb-2 overflow-hidden hide-scrollbar">
                        <span class="inline-block transform scale-x-150 text-[9px] sm:text-[8px] md:text-[8px] lg:text-[9px]">{movie.type.split(',').slice(0, 2).join(' • ')}</span>
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
        {/if}
        </div>
        <!-- Button: Right -->
        <button type="button" class="mx-2 min-w-[50px] h-[170px] py-[55px] rounded-r-lg bg-black bg-opacity-20 hover:bg-opacity-30 z-10" on:click={multiColumnRight}>
            <ChevronRight class="white transition-transform transform hover:scale-[115%] w-full h-full" />
        </button>
        </div>
    </section>