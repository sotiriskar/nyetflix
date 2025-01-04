<script lang="ts">
    import '../../app.postcss';
    import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
    import { AppShell, storeHighlightJs, storePopup } from '@skeletonlabs/skeleton';
    import { Settings, UserRoundPen } from 'lucide-svelte';
    import TopBar from '$lib/components/TopBar.svelte';
    import NavBar from '$lib/components/NavBar.svelte';
    import { goto } from '$app/navigation';
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

    let newPassword: string = '';
    let currentTile: number = 0;
    let movieTitles: any[] = [];
    let movies: any[] = [];
    let username: string = '';
    let pronouns: string = '';
    let userId: number;

    let usernameError: string = '';
    let passwordError: string = '';


    import { initializeStores, Modal, getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';
    import { Toast, getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';

    initializeStores();

    const toastStore = getToastStore();
    function showToast(message: string, background: string) {
        const t: ToastSettings = {
            message,
            background,
        };
        toastStore.trigger(t);
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

    const modalStore = getModalStore();

    function confirmAccountDeletion() {
        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Delete Account',
            body: 'Are you sure you want to delete your account? This action cannot be undone.',
            response: async (r: boolean) => {
                if (r) {
                    try {
                        const response = await fetch('/api/user/delete', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ userId })
                        });
                        if (!response.ok) {
                            showToast('Failed to delete account', 'bg-red-500');
                        } else {
                            showToast('Account deleted successfully', 'bg-primary-500');
                        }
                    } catch (error) {
                        console.error('Error updating user data:', error);
                        showToast('Failed to delete account', 'bg-red-500');
                    }
                    // logout
                    handleLogout();
                }
            },
        };
        modalStore.trigger(modal);
    }

    onMount(async () => {
        try {
            const movieResponse = await fetch('/api/movies');
            if (movieResponse.ok) {
                movies = await movieResponse.json();
                movieTitles = movies.map(movie => movie.title);
            } else {
                console.error('Failed to fetch movies:', movieResponse.statusText);
            }

            const userResponse = await fetch('/api/user/');
            if (userResponse.ok) {
                const data = await userResponse.json();
                if (Array.isArray(data) && data.length > 0) {
                    const userData = data[0];
                    if (userData.username) {
                        username = userData.username;
                        pronouns = userData.pronouns.toLowerCase();
                        userId = userData.user_id;
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
        usernameError = '';
        if (!username || username.length < 4) {
            usernameError = 'Username must be at least 4 characters long';
            showToast('Failed to update user data', 'bg-red-500');
            return;
        }

        try {
            const response = await fetch('/api/user/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, username, pronouns })
            });
            if (!response.ok) {
                showToast('Failed to update user data', 'bg-red-500');
            } else {
                showToast('User data updated successfully', 'bg-primary-500');
            }
        } catch (error) {
            console.error('Error updating user data:', error);
            showToast('Failed to update user data', 'bg-red-500');
        }
    }

    async function updatePassword(newPassword: string) {
        passwordError = '';
        if (!newPassword || newPassword.length < 4) {
            passwordError = 'Password must be at least 4 characters long';
            showToast('Failed to update password', 'bg-red-500');
            return;
        }

        try {
            const response = await fetch('/api/user/password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, newPassword })
            });
            if (!response.ok) {
                showToast('Failed to update password', 'bg-red-500');
            } else {
                showToast('Password updated successfully', 'bg-primary-500');
            }
        } catch (error) {
            console.error('Error updating password:', error);
            showToast('Failed to update password', 'bg-red-500');
        }
    }
</script>

<!-- Pop Up -->
<Toast />

<!-- Modal -->
<Modal />

<svelte:head>
    <title>Nyetflix - Settings</title>
</svelte:head>

<!-- App Shell -->
<AppShell>
    <svelte:fragment slot="header">
        <TopBar {movies} {movieTitles} />
    </svelte:fragment>
    <section class="flex w-full h-full">
        <NavBar bind:currentTile={currentTile} />
        <section class="pt-10 pb-10 flex-grow ml-10 lg:ml-20 md:px-[10vw]">
            <h2 class="text-3xl font-bold my-3 flex items-center">
                <Settings class="w-10 inline-block mr-2" />
                General
            </h2>
            <hr />
            <div class="flex flex-col gap-4">
                <div class="form-row">
                    <h4 class="text-xl font-bold pb-4 pt-5">Username</h4>
                    <input type="text" bind:value={username} class="border bg-surface-700 text-surface-50 rounded-lg" />
                    {#if usernameError}
                        <div class="text-red-500 text-sm">{usernameError}</div>
                    {/if}
                </div>
                <div class="form-row">
                    <h4 class="text-xl font-bold pb-4">Pronouns</h4>
                    <select bind:value={pronouns} class="border bg-surface-700 text-surface-50 rounded-lg pb-2">
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
                <h2 class="text-2xl font-bold my-3 ml-4 flex items-center">
                    <UserRoundPen class="w-10 inline-block mr-2" />
                    Profile Settings
                </h2>
                <hr class="border-t-2 px-4" />
                <div class="form-row gap-4">
                    <h4 class="text-xl font-bold pb-4">Change Password</h4>
                    <input type="password" bind:value={newPassword} class="border bg-surface-700 text-surface-50 rounded-lg p-2 mr-4 mb-4" />
                    <button class="border bg-primary-500 text-surface-50 rounded-lg p-2 w-[150px]" on:click={() => updatePassword(newPassword)}>Change Password</button>
                    {#if passwordError}
                        <div class="mt-2 text-red-500 text-sm">{passwordError}</div>
                    {/if}
                </div>
                <div class="form-row pb-8">
                    <h4 class="text-xl font-bold pb-4">Delete Account</h4>
                    <button class="border bg-red-500 text-surface-50 rounded-lg p-2 w-[150px]" on:click={confirmAccountDeletion}>Delete Account</button>
                </div>
            </div>
        </section>
    </section>
</AppShell>