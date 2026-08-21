// marketing/vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	environments: {
		client: {
			build: {
				target: ['es2019', 'safari14', 'ios14'],
				cssTarget: ['safari14', 'ios14']
			}
		}
	}
});
