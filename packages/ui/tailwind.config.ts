import typegraphy from '@tailwindcss/typography'
import { theme } from '@allmaps/tailwind'
import plugin from 'tailwindcss/plugin';

import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './dist/components/**/*.{html,js,svelte,ts}'
  ],
  theme,
  plugins: [
    typegraphy,
    plugin(function ({ addVariant, matchUtilities, theme }) {
      addVariant('hocus', ['&:hover', '&:focus']);
      // Square utility
      matchUtilities(
        {
          square: (value) => ({
            width: value,
            height: value,
          }),
        },
        { values: theme('spacing') }
      );
    }),
  ]
} satisfies Config
