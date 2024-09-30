<script lang="ts">
    import { AppBar, Avatar, Autocomplete } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import { popup } from '@skeletonlabs/skeleton';
    import { goto } from '$app/navigation';

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
</script>

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
        <Avatar initials="SK" background="bg-primary-500" class="h-9 w-9 mr-2" />
    </svelte:fragment>
</AppBar>
