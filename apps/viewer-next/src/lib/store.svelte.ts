import { SvelteURLSearchParams, SvelteURL } from 'svelte/reactivity';

export class Store {
	done = $state(false);

	url = new SvelteURL('http://localhost')
	urls = $derived(this.url.searchParams.getAll('url'));
	data = $derived(this.url.searchParams.get('data'));

	maps = $state([]);

	constructor(url: URL) {
		this.url = new SvelteURL(url);

		$effect(() => {

		});
	}

	updateURL(url: URL) {
		this.url = new SvelteURL(url);
	}

	updateHref(href: string) {
		this.url.href = href;
	}
}
