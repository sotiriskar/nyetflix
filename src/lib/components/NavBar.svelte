<script lang="ts">
    import { AppRail, AppRailAnchor, TabGroup, TabAnchor } from '@skeletonlabs/skeleton';
    import { House, Search, Library, Settings } from 'lucide-svelte';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    export let currentTile: number;
    let isMobile = window.matchMedia('(max-width: 768px)').matches;

    const checkScreenWidth = () => {
        isMobile = window.innerWidth <= 768; // Adjust the width threshold as needed
    };

    onMount(() => {
        window.addEventListener('resize', checkScreenWidth);
        return () => window.removeEventListener('resize', checkScreenWidth);
    });
</script>

{#if isMobile}
    <TabGroup 
        justify="justify-center"
        active="variant-filled-primary"
        hover="hover:variant-soft-primary"
        flex="flex-row"
        rounded=""
        border=""
        class="bg-surface-100-800-token w-full bottom-0 fixed z-20"
    >
        <TabAnchor selected={$page.url.pathname === '/'} name="home" title="Home" href="/" class="w-[25%] flex items-center justify-center">
            <svelte:fragment slot="lead">
                <House/>
            </svelte:fragment>
        </TabAnchor>
        <TabAnchor selected={$page.url.pathname === '/discover'} name="search" title="Search" href="/discover" class="w-[25%] flex items-center justify-center">
            <svelte:fragment slot="lead">
                <Search/>
            </svelte:fragment>
        </TabAnchor>
        <TabAnchor selected={$page.url.pathname === '/library'} name="library" title="Library" href="/library" class="w-[25%] flex items-center justify-center">
            <svelte:fragment slot="lead">
                <Library/>
            </svelte:fragment>
        </TabAnchor>
        <TabAnchor selected={$page.url.pathname === '/settings'} name="settings" title="Settings" href="/settings" class="w-[25%] flex items-center justify-center">
            <svelte:fragment slot="lead">
                <Settings/>
            </svelte:fragment>
        </TabAnchor>
    </TabGroup>
{:else}
    <AppRail class="flex flex-col items-center justify-center pb-[20%] fixed">
        <AppRailAnchor selected={$page.url.pathname === '/'} name="home" title="Home" href="/">
            <svelte:fragment slot="lead">
                <House class="w-20"/>
            </svelte:fragment>
        </AppRailAnchor>
        <AppRailAnchor selected={$page.url.pathname === '/discover'} name="search" title="Search" href="/discover">
            <svelte:fragment slot="lead">
                <Search class="w-20"/>
            </svelte:fragment>
        </AppRailAnchor>
        <AppRailAnchor selected={$page.url.pathname === '/library'} name="library" title="Library" href="/library">
            <svelte:fragment slot="lead">
                <Library class="w-20"/>
            </svelte:fragment>
        </AppRailAnchor>
        <AppRailAnchor selected={$page.url.pathname === '/settings'} name="settings" title="Settings" href="/settings">
            <svelte:fragment slot="lead">
                <Settings class="w-20"/>
            </svelte:fragment>
        </AppRailAnchor>
    </AppRail>
{/if}