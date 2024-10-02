<script lang="ts">
    import '../../app.postcss';
    import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
    import { AppShell, storeHighlightJs, storePopup } from '@skeletonlabs/skeleton';
    import { Settings, UserRoundPen } from 'lucide-svelte';
    import TopBar from '$lib/components/TopBar.svelte';
    import NavBar from '$lib/components/NavBar.svelte';
    import { onMount } from 'svelte';

    // Highlight JS
    import hljs from 'highlight.js/lib/core';
    import 'highlight.js/styles/github-dark.css';
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
    storePopup.set({ computePosition, autoUpdate, flip, shift, offset, arrow });

    let currentTile: number = 0;
    let movieTitles: any[] = [];
    let movies: any[] = [];
    let username: string = '';
    let pronouns: string = '';

    onMount(async () => {
    try {
        const movieResponse = await fetch('/api/movies');
        if (movieResponse.ok) {
            movies = await movieResponse.json();
            movieTitles = movies.map(movie => movie.title);
        } else {
            console.error('Failed to fetch movies:', movieResponse.statusText);
        }

        const userResponse = await fetch('/api/users');
        if (userResponse.ok) {
            const data = await userResponse.json();
            if (Array.isArray(data) && data.length > 0) {
                const userData = data[0];
                if (userData.username) {
                    username = userData.username;
                    pronouns = userData.pronouns.toLowerCase();
                } else {
                    console.error('Username is undefined');
                }
            } else {
                console.error('User data array is empty or not an array');
            }
        } else {
            console.error('Failed to fetch user data:', userResponse.statusText);
        }

        // Parse the URL to get the search query
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('movie') || '';
    } catch (error) {
        console.error('Error fetching data:', error);
    }
});

    async function updateUserData() {
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, pronouns })
            });
            if (!response.ok) {
                console.error('Failed to update user data:', await response.text());
            }
        } catch (error) {
            console.error('Error updating user data:', error);
        }
    }

    import { Toast, getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { initializeStores } from '@skeletonlabs/skeleton';

    initializeStores();

    const toastStore = getToastStore();

    function showToast(message: string) {
        const t: ToastSettings = {
            message,
            background: 'bg-primary-500',
        };
        toastStore.trigger(t);
    }
</script>

<style>
    .main-content {
        margin-left: 80px; /* Adjust this value based on the actual width of your AppRail */
    }
    .form-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
</style>

<!-- Pop Up -->
<Toast />

<!-- App Shell -->
<AppShell>
    <svelte:fragment slot="header">
        <TopBar {movies} {movieTitles} />
    </svelte:fragment>
    <!-- Flex Container -->
    <section class="flex w-full h-full">
        <!-- NavBar Component -->
        <NavBar bind:currentTile={currentTile} />
        <!-- Movies Grid -->
        <section class="pl-10 pr-10 pt-10 flex-grow main-content">
            <h2 class="text-3xl font-bold my-3 ml-3">
                <Settings class="w-10 inline-block" />
                General
            </h2>
            <hr class="!border-t-2 px-4" />
            <div class="form-container">
                <div class="form-row">
                    <h4 class="text-xl font-bold pb-4 pt-5">Username</h4>
                    <input type="text" bind:value={username} class="border bg-surface-700 text-surface-50 rounded-lg p-2 w-1/3" />
                </div>
                <div class="form-row">
                    <h4 class="text-xl font-bold pb-4">Pronouns</h4>
                    <select bind:value={pronouns} class="border bg-surface-700 text-surface-50 rounded-lg pb-2 w-1/3">
                        <option value="he/him">He/Him</option>
                        <option value="she/her">She/Her</option>
                        <option value="they/them">They/Them</option>
                        <option value="ze/hir">Ze/Hir</option>
                        <option value="xe/xem">Xe/Xem</option>
                        <option value="ver/vir">Ver/Vir</option>
                        <option value="te/tem">Te/Tem</option>
                    </select>
                </div>
                <div class="form-row pb-6 pt-5">
                    <button class="border bg-primary-500 text-surface-50 rounded-lg p-2 w-[150px]" on:click={updateUserData}>Update Profile</button>
                </div>
                <h2 class="text-2xl font-bold my-3 ml-4">
                    <UserRoundPen class="w-10 inline-block" />
                    Profile Settings</h2>
                <hr class="!border-t-2 px-4" />
                <div class="form-row">
                    <h4 class="text-xl font-bold pb-4">Change Password</h4>
                    <input type="password" class="border bg-surface-700 text-surface-50 rounded-lg p-2 w-1/3 mr-4" />
                    <button class="border bg-primary-500 text-surface-50 rounded-lg p-2 w-[150px]" on:click={() => showToast('Password changed successfully!')}>Change Password</button>
                </div>
                <div class="form-row pb-8">
                    <h4 class="text-xl font-bold pb-4">Delete Account</h4>
                    <button class="border bg-error-500 text-surface-50 rounded-lg p-2 w-[150px]" on:click={() => showToast('Account deleted successfully!')}>Delete Account</button>
                </div>
            </div>
        </section>
    </section>
</AppShell>