<script>
	import '../app.css';
	import '@allmaps/ui/css/fonts.css';
	import { Store } from '$lib/store.svelte.ts';
	import { afterNavigate } from '$app/navigation';
	import { browser } from '$app/environment';
	import { fade } from 'svelte/transition';
	import {
		addUrlSource,
		addStringSource,
		resetSources,
		sourcesCount,
		firstSource
	} from '$lib/shared/stores/sources.js';
	import { mapCount } from '$lib/shared/stores/maps.js';
	import { resetRenderOptionsLayer } from '$lib/shared/stores/render-options.js';
	import { setPrevMapActive, setNextMapActive } from '$lib/shared/stores/active.js';
	import {
		createMapOl,
		createImageOl,
		createImageInfoCache,
		mapVectorLayerOutlinesVisible
	} from '$lib/shared/stores/openlayers.js';
	import { nextTransformation } from '$lib/shared/stores/transformation.js';
	import experimentalFeatures from '$lib/shared/experimental-features.js';

	import { Header, Loading, URLInput, URLType, Stats, dataStore, paramStore } from '@allmaps/ui';

	import { Navigation } from '@allmaps/ui/kit';

	import 'ol/ol.css';
	import { onMount } from 'svelte';

	console.log('created layout');

	let { children, data } = $props();
	const store = new Store(data.url);

	$effect(() => {
		store.updateHref(data.url.href);
	});

	onMount(() => {
		console.log('mount layout');
		createMapOl();
		createImageOl();
		createImageInfoCache();
	});

	// afterNavigate(() => {
	// 	store.updateURL(data.url)
	// })

	// $inspect(data)
	// $inspect(store.urls);
	$effect(() => {
		resetRenderOptionsLayer();
		resetSources();
		if (store.urls.length > 0) {
			for (let url of store.urls) {
				// addUrlSource(url)
				console.log('add url', url);
			}
		}
	});
</script>

<Stats />

<Navigation />

<div class="absolute w-full h-full flex flex-col">
	<div class="z-10">
		<Header appName="Viewer" transparent={true}></Header>
	</div>
	<main class="relative h-full overflow-hidden">
		{@render children()}
	</main>
</div>
