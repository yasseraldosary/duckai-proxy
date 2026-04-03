import { injectScriptTag } from './inject-script-tag.js';

const SCRIPT_ID = 'site-local-storage-defaults-script';

export function injectLocalStorageDefaults(text, localStorageDefaults = {}) {
  const scriptTag = renderLocalStorageDefaultsScript(localStorageDefaults);
  if (!scriptTag) {
    return text;
  }

  return injectScriptTag(text, scriptTag, SCRIPT_ID, 'head-start');
}

export function renderLocalStorageDefaultsScript(localStorageDefaults = {}) {
  const entries = Object.entries(localStorageDefaults);
  if (entries.length === 0) {
    return '';
  }

  return `
<script id="${SCRIPT_ID}">
  (function () {
    var defaults = ${JSON.stringify(localStorageDefaults)};

    try {
      Object.keys(defaults).forEach(function (key) {
        if (window.localStorage.getItem(key) !== null) {
          return;
        }

        var value = defaults[key];
        if (value === undefined || value === null) {
          return;
        }

        window.localStorage.setItem(key, String(value));
      });
    } catch (error) {}
  })();
</script>`;
}
