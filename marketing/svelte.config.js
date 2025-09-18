// marketing/svelte.config.js
import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Using adapter-vercel for explicit Vercel deployment with Node 18
		adapter: adapter({
			runtime: 'nodejs18.x'
		})
	}
};

export default config;