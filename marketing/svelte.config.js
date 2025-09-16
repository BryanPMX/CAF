// marketing/svelte.config.js
import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Using adapter-auto for Vercel deployment
		adapter: adapter({
			runtime: 'nodejs18.x'
		})
	}
};

export default config;