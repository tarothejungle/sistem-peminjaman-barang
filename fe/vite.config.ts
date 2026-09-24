import { fileURLToPath, URL } from 'node:url'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { LEGACY_BROWSER_TARGETS, LEGACY_CSS_TARGETS } from './browser-targets.js'

function legacyCspCompatibility(base: string): Plugin {
  let outputDirectory: string | undefined

  return {
    name: 'legacy-csp-compatibility',
    enforce: 'post',
    configResolved(config) {
      outputDirectory = config.build.outDir
    },
    async closeBundle() {
      if (!outputDirectory) return
      const directory = outputDirectory
      const entries = await readdir(directory, { recursive: true, withFileTypes: true })

      for (const entry of entries) {
        const extension = entry.name.split('.').pop()
        if (!entry.isFile() || (extension !== 'html' && extension !== 'js')) continue
        const filePath = join(entry.parentPath, entry.name)
        const source = await readFile(filePath, 'utf8')
        if (!source.includes('data:text/javascript')) continue

        let updatedSource = source
        for (const dataScriptImport of source.matchAll(/import(['"])data:text\/javascript,((?:(?!\1).)+)\1/g)) {
          const isHtml = entry.name.endsWith('.html')
          const probeSource = decodeURIComponent(dataScriptImport[2])
          const probeHash = createHash('sha256').update(probeSource).digest('hex').slice(0, 12)
          const probePath = isHtml
            ? `${base}legacy-csp-probe.js`
            : `./modern-probe-${probeHash}.js`
          if (!isHtml) {
            await writeFile(join(dirname(filePath), `modern-probe-${probeHash}.js`), probeSource)
          }
          updatedSource = updatedSource.replace(dataScriptImport[0], `import"${probePath}"`)
        }

        await writeFile(filePath, updatedSource)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/app/',
  plugins: [
    react(),
    legacy({
      // Shared with postcss.config.js — see browser-targets.js for why webOS is
      // expressed as its Chromium baseline instead of 'webos >= 3'.
      targets: LEGACY_BROWSER_TARGETS,
      // core-js@3 + regenerator polyfills injected from detected usage
      // (Promise, Object.assign, Array.from, Array.flatMap, Symbol.iterator, ...).
      polyfills: true,
      /*
       * DOM APIs core-js does not cover, so `polyfills: true` cannot detect them.
       *
       * whatwg-fetch: fetch is not an ECMAScript builtin. Only installs itself when
       *   window.fetch is absent, so it is inert on Chromium 40+.
       *
       * abortcontroller-polyfill: AbortController lands in Chromium 66, but the
       *   modern-chunk probe in index.html requires import.meta.resolve (Chromium 105),
       *   so every pre-105 engine runs this legacy chunk. @tanstack/react-query calls
       *   `new AbortController()` UNGUARDED on every fetch (query-core query.js), which
       *   throws ReferenceError on webOS 4.x/5.x and leaves the query stuck pending —
       *   that is what made /smart-tv show "Informasi ruang belum tersedia".
       *   The -only build installs the globals without monkey-patching window.fetch;
       *   axios prefers its XHR adapter, and both that adapter and whatwg-fetch honour
       *   signal.addEventListener('abort'), so patching fetch buys nothing here.
       */
      additionalLegacyPolyfills: [
        'whatwg-fetch',
        'abortcontroller-polyfill/dist/abortcontroller-polyfill-only',
      ],
    }),
    legacyCspCompatibility('/app/'),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../be/public/app', import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
    },
    // SystemJS legacy chunks need terser; esbuild/oxc cannot emit ES5.
    minify: 'terser',
    /*
     * Overrides the plugin's chrome61 default, which is still too new: Chromium 38
     * cannot parse 8-digit hex or the `inset` shorthand that the minifier would
     * otherwise emit from the Tailwind output.
     */
    cssTarget: LEGACY_CSS_TARGETS,
  },
})
