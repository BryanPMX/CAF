// marketing/svelte.config.js
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Using adapter-vercel for explicit Vercel deployment
		adapter: adapter({
			runtime: 'nodejs24.x'
		})
	}
};

export default config;
