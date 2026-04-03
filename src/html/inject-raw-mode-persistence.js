import { injectScriptTag } from './inject-script-tag.js';

const SCRIPT_ID = 'site-raw-mode-script';

export function injectRawModePersistence(text, rawModeParam) {
  const rawModeScript = `
<script id="${SCRIPT_ID}">
  (function () {
    var rawModeParam = ${JSON.stringify(rawModeParam)};

    function toRawUrl(input) {
      var url = new URL(input, window.location.href);
      if (url.origin !== window.location.origin) {
        return url.toString();
      }

      url.searchParams.set(rawModeParam, '1');
      return url.toString();
    }

    var originalPushState = history.pushState;
    history.pushState = function (state, unused, url) {
      if (typeof url === 'string') {
        return originalPushState.call(history, state, unused, toRawUrl(url));
      }

      return originalPushState.call(history, state, unused, url);
    };

    var originalReplaceState = history.replaceState;
    history.replaceState = function (state, unused, url) {
      if (typeof url === 'string') {
        return originalReplaceState.call(history, state, unused, toRawUrl(url));
      }

      return originalReplaceState.call(history, state, unused, url);
    };

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') {
        return;
      }

      var link = target.closest('a[href]');
      if (!link) {
        return;
      }

      if (link.target && link.target !== '_self') {
        return;
      }

      try {
        link.href = toRawUrl(link.href);
      } catch (error) {}
    }, true);

    document.addEventListener('submit', function (event) {
      var form = event.target;
      if (!form || !form.action) {
        return;
      }

      try {
        form.action = toRawUrl(form.action);
      } catch (error) {}
    }, true);

    if (window.location.search.indexOf(rawModeParam + '=1') === -1) {
      history.replaceState(history.state, '', toRawUrl(window.location.href));
    }
  })();
</script>`;

  return injectScriptTag(text, rawModeScript, SCRIPT_ID, 'body-end');
}
