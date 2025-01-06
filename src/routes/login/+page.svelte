<script lang="ts">
    import '../../app.postcss';
    import { AppShell, storeHighlightJs } from '@skeletonlabs/skeleton';
    import { Toast, getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { goto } from '$app/navigation';

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

    initializeStores();
    const toastStore = getToastStore();

    function showToast(message: string) {
        const t: ToastSettings = {
            message,
            background: 'bg-[#ff4654]',
        };
        toastStore.trigger(t);
    }

    function handleForgotPassword() {
        showToast("Did you check your password.txt?");
    }

    let username = '';
    let password = '';
    let errorMessage = '';

    async function handleLogin(event: Event) {
        event.preventDefault();
        errorMessage = '';
        try {
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                goto('/');
            } else {
                const errorText = await response.text();
                if (errorText) {
                    try {
                        const error = JSON.parse(errorText);
                        errorMessage = error.error;
                        console.error('Login failed:', error);
                    } catch (e) {
                        errorMessage = 'An unexpected error occurred. Please try again later.';
                        console.error('Error parsing error response:', e);
                    }
                } else {
                    errorMessage = 'An unexpected error occurred. Please try again later.';
                    console.error('Empty error response');
                }
            }
        } catch (error) {
            errorMessage = 'An unexpected error occurred. Please try again later.';
            console.error('Error during login:', error);
        }
    }
</script>

<!-- Pop Up -->
<Toast />

<svelte:head>
    <title>Nyetflix - Login</title>
</svelte:head>

<!-- App Shell -->
<AppShell class="w-full h-full bg-[linear-gradient(90deg,_#111823_70%,_#1a2330_70%,_#ff4654_70%)]">
    <section class="flex items-center justify-center h-full w-full px-10 py-2">
        <form 
            class="px-10 py-12 rounded-lg shadow-[0_4px_12px_4px_rgba(0,0,0,0.5)] w-full max-h-full max-w-sm min-w-[304px] bg-[#0F1821]" 
            on:submit={handleLogin}>
            <div class="flex justify-center mb-6">
                <img src="/nyetflix-logo.png" alt="Nyetflix Logo" class="w-full px-2 object-contain"/>
            </div>
            <div class="mb-9">
                <label class="block text-sm font-bold mb-2 text-[#EBE8E1]" for="username">Username</label>
                <input class="shadow appearance-none rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline border-[#EBE8E1] border-opacity-60 bg-[#111823] placeholder-[#EBE8E1] placeholder-opacity-60" id="username" type="text" bind:value={username} placeholder="Username" />
            </div>
            <div class="mb-1">
                <label class="block text-sm font-bold mb-2 text-[#EBE8E1]" for="password">Password</label>
                <input class="shadow appearance-none rounded w-full py-2 px-3 mb-3 leading-tight focus:outline-none focus:shadow-outline border-[#EBE8E1] border-opacity-60 bg-[#111823] placeholder-[#EBE8E1] placeholder-opacity-60" id="password" type="password" bind:value={password} placeholder="Password" />
            </div>
            {#if errorMessage}
                <div class="text-[#ff4654] text-sm mb-3">{errorMessage}</div>
            {/if}
            <div class="flex items-center justify-between overflow-hidden">
                <button type="button" class="text-sm hover:underline ml-auto text-[#EBE8E1]" on:click|preventDefault={handleForgotPassword}>Forgot your password?</button>
            </div>
            <div class="flex items-center justify-between mt-7">
                <button class="bg-[#ff4654] hover:bg-[#ba3a46] font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full text-[#EBE8E1]" type="submit">
                    Login
                </button>
            </div>
        </form>
    </section>
</AppShell>