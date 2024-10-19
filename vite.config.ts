import { purgeCss } from 'vite-plugin-tailwind-purgecss';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), purgeCss()],
	server: {
		host: true, // This makes the server listen on all network interfaces
		port: 5173, // The port you're using
		strictPort: true, // Prevents Vite from changing the port if 5173 is in use
		watch: {
			usePolling: true, // Useful for some environments (like Docker)
		},
	},
});