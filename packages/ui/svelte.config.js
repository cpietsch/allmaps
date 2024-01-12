import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/kit/vite'
import { preprocessMeltUI, sequence } from '@melt-ui/pp'


/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess:  sequence([
      vitePreprocess({
        postcss: true
      }),
      preprocessMeltUI() // add to the end!
    ]),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false
    })
  }
}

export default config
