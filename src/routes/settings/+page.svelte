<script lang="ts">
    import '../../app.postcss';
    import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
    import { AppShell, storeHighlightJs, storePopup } from '@skeletonlabs/skeleton';
    import { Settings, UserRoundPen } from 'lucide-svelte';
    import TopBar from '$lib/components/TopBar.svelte';
    import NavBar from '$lib/components/NavBar.svelte';
    import { writable } from 'svelte/store';
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

    function getUserIdFromCookie() {
        const sessionCookie = document.cookie.split('; ').find(row => row.startsWith('session='));
        if (sessionCookie) {
            try {
                const userInfo = JSON.parse(decodeURIComponent(sessionCookie.split('=')[1]));
                return userInfo.id;
            } catch (err) {
                console.error('Failed to parse session cookie:', err);
            }
        }
        return null;
    }

    let bookmarkedMovies = writable(new Set());
    let currentTile: number = 0;
    let movieTitles: any[] = [];
    let movies: any[] = [];

    onMount(async () => {
        const response = await fetch('/api/movies');
        if (response.ok) {
            movies = await response.json();
            movieTitles = movies.map(movie => movie.title);
        } else {
            console.error('Failed to fetch movies:', response.statusText);
        }

        const userId = getUserIdFromCookie();
        const bookmarkResponse = await fetch(`/api/users/${userId}/bookmark`);
        if (bookmarkResponse.ok) {
            const bookmarks = await bookmarkResponse.json();
            bookmarkedMovies.set(new Set(bookmarks.map((bookmark: { movie_id: any; }) => bookmark.movie_id)));
        } else {
            console.error('Failed to fetch bookmarks:', bookmarkResponse.statusText);
        }

        // Parse the URL to get the search query
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('movie') || '';
    });

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
                    <input type="text" class="border bg-surface-700 text-surface-50 rounded-lg p-2 w-1/3" />
                </div>
                <div class="form-row">
                    <h4 class="text-xl font-bold pb-4">Pronouns</h4>
                    <select class="border bg-surface-700 text-surface-50 rounded-lg pb-2 w-1/3">
                        <option value="he/him">He/Him</option>
                        <option value="she/her">She/Her</option>
                        <option value="they/them">They/Them</option>
                        <option value="ze/hir">Ze/Hir</option>
                        <option value="xe/xem">Xe/Xem</option>
                        <option value="ver/vir">Ver/Vir</option>
                        <option value="te/tem">Te/Tem</option>
                        <option value="e/em">E/Em</option>
                    </select>
                </div>
                <div class="form-row pb-6 pt-5">
                    <button class="border bg-primary-500 text-surface-50 rounded-lg p-2 w-[150px]" on:click={() => showToast('Changes successful!')}>Update Profile</button>
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