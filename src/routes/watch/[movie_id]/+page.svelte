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
  let movie: { movie_id: any; };
  let arrowVisible = true;
  let timeoutId: number;
  let movieId: string;
  let videoElement: HTMLVideoElement;

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
    const unsubscribe = page.subscribe(($page) => {
      movieId = $page.params.movie_id;
    });
    onMount(async () => {
      if (movieId) {
        const response = await fetch('/api/movies');
        if (response.ok) {
          const movies = await response.json();
          movie = movies.find((m: { movie_id: any; }) => String(m.movie_id) === String(movieId));
        }
      }
      unsubscribe();
    });
  }
</script>

<div class="bg-gray-900 w-screen h-screen flex items-center justify-center">
  <a href="/" class="absolute top-4 left-4 cursor-pointer z-10" class:hidden={!arrowVisible} on:click={() => goto('/')}>
    <ArrowLeft class="w-8 h-8" />
  </a>
  {#if movie}
    <VideoPlayer {movieId} />
  {:else}
    <p>Loading...</p>
  {/if}
</div>