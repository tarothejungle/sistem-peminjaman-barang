/**
 * Single source of truth for the legacy browser support matrix.
 *
 * Consumed by:
 *  - vite.config.ts    -> @vitejs/plugin-legacy `targets` (JS transpile + polyfills)
 *                      -> build.cssTarget (CSS syntax lowering)
 *  - postcss.config.js -> autoprefixer `overrideBrowserslist` (vendor prefixes)
 *
 * 'webos >= 3' is deliberately absent: webos is NOT a browserslist-known browser
 * and throws "Unknown browser webos". webOS TVs are expressed as their Chromium
 * baseline instead. Per LG's official web engine table:
 *   webOS 3.x = Chromium 38   webOS 4.x = Chromium 53   webOS 5.x = Chromium 68
 *   webOS 6.x = Chromium 79   webOS 22  = Chromium 87
 * https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine
 *
 * chrome 49 is the floor rather than 38 because CSS custom properties (var())
 * start at Chrome 49, and both Tailwind 3's --tw-* utilities and this app's theme
 * tokens are built on them. A webOS 3.x TV would render an unstyled page no matter
 * how far the JS is transpiled, so 49 is the lowest version worth claiming.
 * This covers webOS 4.x and up, including the Chromium 68 target in question.
 */
export const LEGACY_BROWSER_TARGETS = [
  'chrome >= 49',
  'safari >= 10',
  'ios >= 10',
];

/**
 * Same matrix in esbuild syntax for build.cssTarget.
 *
 * Keep safari10/ios10 alongside chrome49: with a lone 'chrome49' the CSS minifier
 * concludes backdrop-filter is unsupported outright and STRIPS the
 * -webkit-backdrop-filter autoprefixer just added. Those Safari versions require
 * the prefix, so listing them preserves it.
 */
export const LEGACY_CSS_TARGETS = ['chrome49', 'safari10', 'ios10'];
