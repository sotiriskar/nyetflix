<script lang="ts">
  import '../../../app.postcss';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  // Highlight JS
  import hljs from 'highlight.js/lib/core';
  import 'highlight.js/styles/github-dark.css';
  import { storeHighlightJs } from '@skeletonlabs/skeleton';
  import { ArrowLeft } from 'lucide-svelte';
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

  // Arrow visibility
  let arrowVisible = true;
  let timeoutId: number;

  const resetTimeout = () => {
    clearTimeout(timeoutId);
    arrowVisible = true;
    timeoutId = setTimeout(() => {
      arrowVisible = false;
    }, 2500);
  };

  // Add event listeners for user activity if in the browser
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keydown', resetTimeout);

    // Initialize timeout
    resetTimeout();
  }

  // Get movie ID from URL
  let movieId;
  let movie;
  let videoElement: HTMLVideoElement;

  $: {
    const unsubscribe = page.subscribe(($page) => {
      movieId = $page.params.movie_id;
    });
    onMount(async () => {
      if (movieId) {
        const response = await fetch('/api/movies');
        if (response.ok) {
          const movies = await response.json();
          movie = movies.find(m => String(m.movie_id) === String(movieId));
        }
      }
      unsubscribe();
    });
  }

  onMount(() => {
    if (videoElement) {
      videoElement.addEventListener('canplay', () => {
        videoElement.play().catch(error => {
          console.error('Error playing video:', error);
        });
      });
    }
  });
</script>

<a href="/" class="absolute top-4 left-4 cursor-pointer z-10" class:hidden={!arrowVisible}>
  <ArrowLeft class="w-8 h-8" />
</a>

<div class="card w-screen h-screen flex items-center justify-center">
  {#if movie}
    <video bind:this={videoElement} controls playsinline autoplay loop class="w-full h-full object-cover">
      <source src={`/trailers/${movie.movie_id}.mp4`} type="video/mp4">
    </video>
  {:else}
    <p>Loading...</p>
  {/if}
</div>