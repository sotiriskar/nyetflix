<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as pkg from '@vime/core';
  const { defineCustomElements, VmTimeProgress, VmPlaybackControl, VmMuteControl, VmControlSpacer, VmControls, VmScrim, VmAudio, VmFile, VmDefaultControls, VmPlayer, VmVideo, VmDefaultUi, VmFullscreenControl, VmSettingsControl, VmPipControl, VmVolumeControl } = pkg;
  defineCustomElements();

  export let movieId: string;
  let subtitleSrcs: { [key: string]: string } = {};
  let defaultSubtitleLang: string = 'en';
  let nonDefaultSubtitleLang: string = 'gr';
  let videoElement: HTMLVmVideoElement;

  onMount(async () => {
    // Fetch subtitle files
    const subtitleLanguages = ['en', 'gr']; // Add more languages as needed
    for (const lang of subtitleLanguages) {
      const subtitleResponse = await fetch(`/api/stream/subtitles?movie_id=${movieId}&lang=${lang}`);
      if (subtitleResponse.ok) {
        subtitleSrcs[lang] = `/api/stream/subtitles?movie_id=${movieId}&lang=${lang}`;
        if (!defaultSubtitleLang) {
          defaultSubtitleLang = lang;
          nonDefaultSubtitleLang = lang === 'en' ? 'gr' : 'en';
        }
      } else {
        subtitleSrcs[lang] = '';
        nonDefaultSubtitleLang = '';
      }
    }

    // Set default subtitle language
    if (!defaultSubtitleLang) {
      defaultSubtitleLang = subtitleSrcs['en'] ? 'en' : subtitleSrcs['gr'] ? 'gr' : '';
    }

    if (videoElement) {
      videoElement.addEventListener('canplay', () => {
        (videoElement as unknown as HTMLVideoElement).play().catch(error => {
          console.error('Error playing video:', error);
        });
      });
    }
  });
</script>

<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@vime/core@^5/themes/default.css"
/>
<div class="w-full h-full flex flex-col items-center overflow-auto">
  <div class="w-full mx-auto">
    <vm-player class="responsive-player" autoplay={true} muted={false} paused={false}>
      <vm-video cross-origin bind:this={videoElement}>
          <source data-src={`/api/stream?movie_id=${movieId}&type=mp4`} type="video/mp4"/>
          <track src={subtitleSrcs[defaultSubtitleLang]} srclang={defaultSubtitleLang} label={defaultSubtitleLang.toUpperCase()} default />
          {#if nonDefaultSubtitleLang}
              <track src={subtitleSrcs[nonDefaultSubtitleLang]} srclang={nonDefaultSubtitleLang} label={nonDefaultSubtitleLang.toUpperCase()} />
          {/if}
      </vm-video>
      <vm-default-ui no-controls>
          <vm-default-controls
              hide-on-mouse-leave
              active-duration="2000"
          ></vm-default-controls>
      </vm-default-ui>
    </vm-player>
  </div>
</div>
