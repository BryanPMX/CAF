// marketing/svelte.config.js
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Using adapter-auto for development
		adapter: adapter()
	}
};

export default config;