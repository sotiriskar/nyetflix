<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import * as pkg from '@vime/core';
  const { defineCustomElements, VmTimeProgress, VmPlaybackControl, VmMuteControl, VmControlSpacer, VmControls, VmScrim, VmAudio, VmFile, VmDefaultControls, VmPlayer, VmVideo, VmDefaultUi, VmFullscreenControl, VmSettingsControl, VmPipControl, VmVolumeControl } = pkg;
  defineCustomElements();

  export let movieId: string;
  export let userId: string;
  export let lastseen: string | null;
  const dispatch = createEventDispatcher();
  let subtitleSrcs: { [key: string]: string } = {};
  let defaultSubtitleLang: string = 'en';
  let nonDefaultSubtitleLang: string = 'gr';
  let videoElement: HTMLVmVideoElement;
  let updateInterval: ReturnType<typeof setInterval>;
  let currentTime: number = 0;

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

    const userResponse = await fetch('/api/user/');
    if (userResponse.ok) {
      const data = await userResponse.json();
      if (Array.isArray(data) && data.length > 0) {
        userId = data[0].user_id;
      }
    }

    // Fetch last seen duration
    const lastSeenResponse = await fetch(`/api/lastseen?movie_id=${movieId}&user_id=${userId}`);
    if (lastSeenResponse.ok) {
      const lastSeenData = await lastSeenResponse.json();
      lastseen = lastSeenData.last_seen;
      console.log('Last seen:', lastseen);
      if (lastseen) {
        currentTime = parseFloat(lastseen);
      }
    }

    if (videoElement) {
      videoElement.addEventListener('timeupdate', () => {
        const currentTime = document.querySelector('video')?.currentTime;
        if (currentTime !== undefined && !isNaN(currentTime)) {
          dispatch('updateProgress', currentTime);
        }
      });

      // Update progress every 10 seconds
      updateInterval = setInterval(() => {
        const currentTime = document.querySelector('video')?.currentTime;
        if (currentTime !== undefined && !isNaN(currentTime)) {
          dispatch('updateProgress', currentTime);
        }
      }, 5000);
    }
  });

  onDestroy(() => {
    clearInterval(updateInterval);
  });
</script>

<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@vime/core@^5/themes/default.css"
/>
<div class="w-full h-full flex flex-col items-center overflow-auto">
  <div class="w-full mx-auto">
    <vm-player class="responsive-player" autoplay={true} muted={false} paused={false} currentTime={currentTime | 0}>
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