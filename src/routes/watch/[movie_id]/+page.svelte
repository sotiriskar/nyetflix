<script lang="ts">
  import '../../../app.postcss';
  import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
  import { storePopup, storeHighlightJs } from '@skeletonlabs/skeleton';
  import VideoPlayer from '$lib/components/VideoPlayer.svelte';
  import { ArrowLeft } from 'lucide-svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  // Highlight JS
  import hljs from 'highlight.js/lib/core';
  import 'highlight.js/styles/github-dark.css';
  import xml from 'highlight.js/lib/languages/xml'; // for HTML
  import css from 'highlight.js/lib/languages/css';
  import javascript from 'highlight.js/lib/languages/javascript';
  import typescript from 'highlight.js/lib/languages/typescript';
  import { goto } from '$app/navigation';

  hljs.registerLanguage('xml', xml); // for HTML
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('typescript', typescript);
  storeHighlightJs.set(hljs);

  // Floating UI for Popups
  storePopup.set({ computePosition, autoUpdate, flip, shift, offset, arrow });

  // Arrow visibility
  let movies = [];
  let selectedMovie: { movie_id: any; title: string } = { movie_id: null, title: '' };
  let movieTitles = [];
  let arrowVisible = true;
  let timeoutId: number;
  let movieId: string;

  const resetTimeout = () => {
    clearTimeout(timeoutId);
    arrowVisible = true;
    timeoutId = window.setTimeout(() => {
      arrowVisible = false;
    }, 2000);
  };

  // Add event listeners for user activity if in the browser
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keydown', resetTimeout);

    // Initialize timeout
    resetTimeout();
  }

  $: {
    page.subscribe(($page) => {
      movieId = $page.params.movie_id;
    });
    onMount(async () => {
      const movieResponse = await fetch('/api/movies');
      if (movieResponse.ok) {
        movies = await movieResponse.json();
        selectedMovie = movies[0];
        movieTitles = movies.map((movie: { title: any; }) => movie.title);
      } else {
        console.error('Failed to fetch movies:', movieResponse.statusText);
      }
    });
  }
</script>

<svelte:head>
    <title>Nyetflix - {selectedMovie.title}</title>
</svelte:head>

<div class="bg-gray-900 w-screen h-screen flex items-center justify-center">
  <a href="/" class="absolute top-4 left-4 cursor-pointer z-10" class:hidden={!arrowVisible} on:click={() => goto('/')}>
    <ArrowLeft class="w-8 h-8" />
  </a>
  {#if selectedMovie.movie_id}
    <VideoPlayer {movieId} />
  {:else}
    <p>Loading...</p>
  {/if}
</div>