<script lang="ts">
    import { AppBar, Avatar, Autocomplete } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import { popup } from '@skeletonlabs/skeleton';
    import { goto } from '$app/navigation';
    import { LogOut } from 'lucide-svelte';
    import { onMount } from 'svelte';

    let movieOptions: { label: any; value: any; }[] = [];
    export let movieTitles: any[] = [];
    let inputPopupDemo: string = '';
    export let movies: any[] = [];
    let initials: string = '';
    interface UserData {
        username: string;
    }

    let userData: UserData = { username: '' };
    let popupSettings: PopupSettings = {
        event: 'focus-click',
        target: 'popupAutocomplete',
        placement: 'bottom',
    };

    $: if (inputPopupDemo.length > 0) {
        console.log('Filtering movie titles with input:', inputPopupDemo);
        movieOptions = movieTitles
            .filter(title => title.toLowerCase().includes(inputPopupDemo.toLowerCase()))
            .slice(0, 3)
            .map(title => ({ label: title, value: title }));
        console.log('Filtered movie options:', movieOptions);
    } else {
        movieOptions = [];
    }

    function onPopupDemoSelect(event: { detail: { value: string; }; }) {
        inputPopupDemo = event.detail.value;
        console.log('Selected movie:', inputPopupDemo);
        const selectedMovie = movies.find(movie => movie.title.toLowerCase() === inputPopupDemo.toLowerCase());
        if (selectedMovie) {
            console.log('Navigating to movie:', selectedMovie.title);
            goto(`/search?movie=${encodeURIComponent(selectedMovie.title.toLowerCase())}`);
        } else {
            console.error('Selected movie not found in movies array');
        }
    }

    function handleKeyPress(event: { key: string; }) {
        if (event.key === 'Enter') {
            console.log('Enter key pressed, navigating to search with input:', inputPopupDemo);
            goto(`/search?movie=${encodeURIComponent(inputPopupDemo.toLowerCase())}`);
        }
    }

    async function handleLogout() {
        try {
            const response = await fetch('/api/logout', {
                method: 'DELETE'
            });

            if (response.ok) {
                goto('/login'); // Redirect to the login page or any other page
            } else {
                console.error('Logout failed:', await response.text());
            }
        } catch (error) {
            console.error('Error during logout:', error);
        }
    }

    const popupFeatured: PopupSettings = {
        event: 'click',
        target: 'popupFeatured',
        placement: 'bottom',
    };

    function getInitials(username: string): string {
        const parts = username.split(/(?=[A-Z])|[_\s]/).filter(Boolean);
        if (parts.length > 1) {
            return parts.map(part => part[0].toUpperCase()).join('');
        }
        return username.slice(0, 2).toUpperCase();
    }

    onMount(async () => {
        try {
            const response = await fetch('/api/user/');
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    userData = data[0];
                    if (userData.username) {
                        initials = getInitials(userData.username);
                    } else {
                        console.error('Username is undefined');
                    }
                } else {
                    console.error('User data array is empty or not an array');
                }
            } else {
                console.error('Failed to fetch user data:', await response.text());
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    });
</script>

<button class="card p-4 w-[150px] shadow-xl" data-popup="popupFeatured" on:click={handleLogout} on:keypress={handleKeyPress}>
    <div>
      <LogOut class="inline-block mr-2" />
      <p class="inline-block text-sm cursor-pointer">Log out</p>
    </div>
</button>

<div class="flex items-center justify-between w-full h-20 bg-surface-800">
    <a href="/" class="focus:outline-0">
        <img src="/nyetflix-logo.png" alt="Nyetflix Logo" class="h-11 ml-3 object-contain"/>
    </a>
    <div class="flex items-center justify-center flex-grow mx-4">
        <input
            class="input autocomplete flex-grow min-w-[7vh] max-w-[30vh] ml-2"
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
    </div>
    <button use:popup={popupFeatured} class="z-10">
        <Avatar initials={initials} background="bg-primary-500" class="h-9 w-9 mr-3"/>
    </button>
</div>