<script lang="ts">
    import { AppRail, AppRailAnchor } from '@skeletonlabs/skeleton';
    import { House, Search, Library, Settings } from 'lucide-svelte';
    import { page } from '$app/stores';

    export let currentTile: number;
</script>

<AppRail class="flex flex-col items-center justify-center pb-40 fixed">
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
    <AppRailAnchor bind:group={currentTile} name="settings" value={3} title="Settings">
        <svelte:fragment slot="lead">
            <Settings class="w-20"/>
        </svelte:fragment>
    </AppRailAnchor>
</AppRail>
