import { LEGACY_BROWSER_TARGETS } from './browser-targets.js';

export default {
  plugins: {
    tailwindcss: {},
    /*
     * Autoprefixer reads the same target list as @vitejs/plugin-legacy so CSS and
     * JS never disagree. This is what emits -webkit-backdrop-filter, the -webkit-
     * flexbox/grid fallbacks, and -webkit-mask-image needed by Chromium 38 TVs.
     */
    autoprefixer: { overrideBrowserslist: LEGACY_BROWSER_TARGETS },
  },
};
