import nodeResolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import {terser} from 'rollup-plugin-terser'
import * as meta from './package.json'

const copyright = `// ${meta.homepage} v${meta.version} Copyright ${(new Date()).getFullYear()} ${meta.author.name}`
const name = meta.name.split('/')[1]

export default [
  {
    input: 'nodejs.js',
    plugins: [
      nodeResolve(),
      babel({
        babelHelpers: 'bundled'
      })
    ],
    output: {
      file: `dist/${name}.mjs`,
      banner: copyright,
      format: 'esm',
      name,
      exports: 'named',
      sourcemap: true,
      globals: {
        crypto: 'crypto'
      }
    }
  },
  {
    input: 'nodejs.js',
    plugins: [
      nodeResolve(),
      babel({
        babelHelpers: 'bundled'
      }),
      terser({output: {preamble: copyright}})
    ],
    output: {
      file: `dist/${name}.min.js`,
      banner: copyright,
      format: 'umd',
      name,
      esModule: false,
      exports: 'named',
      sourcemap: true,
      globals: {
        crypto: 'crypto'
      }
    }
  },
  {
    input: 'web.js',
    plugins: [
      nodeResolve({
        browser: true
      })
    ],
    output: {
      dir: 'dist/esm',
      esModule: true,
      format: 'esm',
      exports: 'named',
      sourcemap: true
    }
  },
  {
    input: 'web.js',
    plugins: [
      nodeResolve({
        browser: true
      }),
      terser({output: {preamble: copyright}})
    ],
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    }
  }
]
