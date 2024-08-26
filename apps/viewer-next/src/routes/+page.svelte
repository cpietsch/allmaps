<script>
	import { Header, Loading, URLInput, URLType, Stats, dataStore, paramStore } from '@allmaps/ui';
	import { goto } from '$app/navigation';

	import { browser } from '$app/environment';
	import { fade } from 'svelte/transition';
	import Examples from '$lib/components/Examples.svelte';

	let urlInputValue = '';
	let annotationString = '';
	let error;

	function handleUrlInputValue(event) {
		urlInputValue = event?.detail?.value;
	}

	async function handleSubmit() {
		console.log('handleSubmit');
		if (urlInputValue && urlInputValue.trim()) {
			goto(`/view?url=${urlInputValue}`);
		} else {
			// todo handle annotationString
		}
	}

	function hasTouch() {
		if (browser) {
			//  - https://css-tricks.com/touch-devices-not-judged-size/
			//  - https://stackoverflow.com/questions/4817029/whats-the-best-way-to-detect-a-touch-screen-device-using-javascript
			return window.matchMedia('(pointer: coarse)').matches;
		}

		return false;
	}

	let autofocus = !hasTouch();
</script>

<div class="h-full flex overflow-y-auto">
	<div class="container mx-auto mt-10 p-2" transition:fade={{ duration: 120 }}>
		<p class="mb-3">Open a IIIF Resource or Georeference Annotation from a URL:</p>
		<URLInput {autofocus} on:value={handleUrlInputValue} />

		<p class="mt-3 mb-3">Or, paste the contents of a complete Georeference Annotation below:</p>
		<form on:submit|preventDefault={handleSubmit}>
			<textarea
				bind:value={annotationString}
				placeholder="Paste a Georeference Annotation here"
				class="font-mono block mb-3 w-full h-60 rounded-lg border border-gray-300 focus-within:ring-1 focus-within:ring-pink-500 focus-within:border-pink-500 text-sm"
				autocomplete="off"
				autocorrect="off"
				autocapitalize="off"
				spellcheck="false"
			></textarea>
			<button
				type="submit"
				disabled={annotationString.length === 0 && urlInputValue.length === 0}
				class="text-white bg-pink-500 hover:bg-pink-400 transition-colors disabled:bg-gray-500 focus:ring focus:ring-pink-200 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 focus:outline-none"
				>View</button
			>
		</form>
		<section>
			<Examples />
		</section>
	</div>
</div>

<style>
</style>
