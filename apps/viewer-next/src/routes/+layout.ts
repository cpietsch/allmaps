import { error } from '@sveltejs/kit';
import { Store } from '$lib/store.svelte.ts'

// export const ssr = false;

console.log("created layout ts")

// const store = new Store()


/** @type {import('./$types').PageLoad} */
export function load({ params, url }) {
    // const urls = url.searchParams.getAll("url")
    // const data = url.searchParams.get("data")

    // store.updateHref(url.href)
    // store.updateURL(url)

	//$inspect(store.data)

	return {
		test: true,
        // data,
        // urls,
        url,
        // store
        //store
	};
}