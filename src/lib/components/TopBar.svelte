<script lang="ts">
    import { AppBar, Avatar, Autocomplete } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import { popup } from '@skeletonlabs/skeleton';
    import { goto } from '$app/navigation';
    import { LogOut } from 'lucide-svelte';

    export let movies: any[] = [];
    export let movieTitles: any[] = [];

    let inputPopupDemo: string = '';
    let movieOptions: { label: any; value: any; }[] = [];

    let popupSettings: PopupSettings = {
        event: 'focus-click',
        target: 'popupAutocomplete',
        placement: 'bottom',
    };

    $: if (inputPopupDemo.length > 0) {
        movieOptions = movieTitles
            .filter(title => title.toLowerCase().includes(inputPopupDemo.toLowerCase()))
            .slice(0, 3)
            .map(title => ({ label: title, value: title }));
    } else {
        movieOptions = [];
    }

    function onPopupDemoSelect(event: { detail: { value: string; }; }) {
        inputPopupDemo = event.detail.value;
        const selectedMovie = movies.find(movie => movie.title.toLowerCase() === inputPopupDemo.toLowerCase());
        if (selectedMovie) {
            goto(`/search?movie=${encodeURIComponent(selectedMovie.title)}`);
        }
    }

    function handleKeyPress(event: { key: string; }) {
        if (event.key === 'Enter') {
            goto(`/search?movie=${encodeURIComponent(inputPopupDemo.toLowerCase())}`);
        }
    }

    const popupFeatured: PopupSettings = {
        // Represents the type of event that opens/closed the popup
        event: 'click',
        // Matches the data-popup value on your popup element
        target: 'popupFeatured',
        // Defines which side of your trigger the popup will appear
        placement: 'bottom',
    };

</script>

<div class="card p-4 w-60 shadow-xl" data-popup="popupFeatured">
    <div>
      <LogOut class="inline-block mr-2" />
      <p class="inline-block text-sm cursor-pointer
      ">Log out</p>
    </div>
</div>

<AppBar gridColumns="grid-cols-3" slotDefault="place-self-center" slotTrail="place-content-end">
    <svelte:fragment slot="lead">
        <a href="/" class="focus:outline-0">
            <img src="/nyetflix-logo.png" alt="Nyetflix Logo" class="h-10 pl-4"/>
        </a>
    </svelte:fragment>
    <input
        class="input autocomplete"
        type="search"
        name="autocomplete-search"
        bind:value={inputPopupDemo}
        placeholder="Search..."
        use:popup={popupSettings}
        on:keypress={handleKeyPress}
    />
    <div data-popup="popupAutocomplete">
        <Autocomplete
            class="bg-surface-800 text-surface-50 rounded-md shadow-md p-4"
            bind:input={inputPopupDemo}
            options={movieOptions}
            on:selection={onPopupDemoSelect}
        />
    </div>		
    <svelte:fragment slot="trail">
        <button use:popup={popupFeatured} class="z-10">
            <Avatar initials="SK" background="bg-primary-500" class="h-9 w-9 mr-2"/>
        </button>
    </svelte:fragment>
</AppBar>
