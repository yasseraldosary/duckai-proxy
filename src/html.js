export async function replaceResponseText(response, upstreamDomain, hostName, request, config) {
  let text = await response.text();

  for (const [sourceKey, targetKey] of Object.entries(config.replaceMap)) {
    const source = resolveReplacementValue(sourceKey, upstreamDomain, hostName);
    const target = resolveReplacementValue(targetKey, upstreamDomain, hostName);
    text = text.replace(new RegExp(source, 'g'), target);
  }

  if (!hasClosedBanner(request, config.bannerCookieName)) {
    text = injectBanner(text, config);
  }

  return text;
}

function resolveReplacementValue(value, upstreamDomain, hostName) {
  if (value === '$upstream') {
    return upstreamDomain;
  }

  if (value === '$custom_domain') {
    return hostName;
  }

  return value;
}

function hasClosedBanner(request, cookieName) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookiePattern = new RegExp(`(?:^|;\\s*)${cookieName}=1(?:;|$)`);
  return cookiePattern.test(cookieHeader);
}

function injectBanner(text, config) {
  if (text.includes('id="site-banner"')) {
    return text;
  }

  const cookieName = JSON.stringify(config.bannerCookieName);
  const cookieMaxAge = JSON.stringify(config.bannerCookieMaxAge);
  const headMarkup = `
<style>
  :root {
    --site-banner-height: 0px;
  }

  html.site-banner-active {
    height: 100% !important;
    overflow: hidden !important;
  }

  body.site-banner-active {
    height: 100% !important;
    overflow: hidden !important;
    margin: 0 !important;
  }

  #site-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px 48px 12px 16px;
    background: #111827;
    color: #f9fafb;
    font-size: 14px;
    line-height: 1.5;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  }

  #site-banner a {
    color: #93c5fd;
    text-decoration: underline;
    word-break: break-all;
  }

  #site-banner button {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    padding: 4px;
  }
</style>
<script>
  (function () {
    if (window.__siteBannerViewportPatch) {
      return;
    }

    var state = window.__siteBannerViewportPatch = {
      offset: 0
    };

    function getOffset() {
      return state.offset || 0;
    }

    function patchWindowHeight(propertyName) {
      var prototype = Object.getPrototypeOf(window);
      var descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
      if (!descriptor || typeof descriptor.get !== 'function') {
        return;
      }

      try {
        Object.defineProperty(window, propertyName, {
          configurable: true,
          get: function () {
            return Math.max(0, descriptor.get.call(window) - getOffset());
          }
        });
      } catch (error) {}
    }

    function patchElementClientHeight(element) {
      if (!element) {
        return;
      }

      var prototype = Object.getPrototypeOf(element);
      var descriptor = Object.getOwnPropertyDescriptor(prototype, 'clientHeight');
      if (!descriptor || typeof descriptor.get !== 'function') {
        return;
      }

      try {
        Object.defineProperty(element, 'clientHeight', {
          configurable: true,
          get: function () {
            return Math.max(0, descriptor.get.call(this) - getOffset());
          }
        });
      } catch (error) {}
    }

    patchWindowHeight('innerHeight');
    patchWindowHeight('outerHeight');
    patchElementClientHeight(document.documentElement);

    if (window.visualViewport) {
      var viewportPrototype = Object.getPrototypeOf(window.visualViewport);
      var viewportDescriptor = Object.getOwnPropertyDescriptor(viewportPrototype, 'height');
      if (viewportDescriptor && typeof viewportDescriptor.get === 'function') {
        try {
          Object.defineProperty(window.visualViewport, 'height', {
            configurable: true,
            get: function () {
              return Math.max(0, viewportDescriptor.get.call(window.visualViewport) - getOffset());
            }
          });
        } catch (error) {}
      }
    }
  })();
</script>`;

  const bannerMarkup = `
<div id="site-banner" role="banner">
  ${config.bannerHtml || '<span></span>'}
  <button type="button" aria-label="关闭横幅">&times;</button>
</div>
<script>
  (function () {
    var state = window.__siteBannerViewportPatch;
    var html = document.documentElement;
    var body = document.body;
    var banner = document.getElementById('site-banner');
    if (!state || !html || !body || !banner) {
      return;
    }

    var pageRoot = null;
    var rootStyleCache = null;
    var bodyClientHeightPatched = false;
    var resizeObserver = null;

    function findPageRoot() {
      var children = Array.from(body.children);
      for (var index = 0; index < children.length; index += 1) {
        var child = children[index];
        if (child.id === 'site-banner') {
          continue;
        }

        if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE' || child.tagName === 'NOSCRIPT') {
          continue;
        }

        return child;
      }

      return null;
    }

    function patchBodyClientHeight() {
      if (bodyClientHeightPatched) {
        return;
      }

      var prototype = Object.getPrototypeOf(body);
      var descriptor = Object.getOwnPropertyDescriptor(prototype, 'clientHeight');
      if (!descriptor || typeof descriptor.get !== 'function') {
        return;
      }

      try {
        Object.defineProperty(body, 'clientHeight', {
          configurable: true,
          get: function () {
            return Math.max(0, descriptor.get.call(this) - (state.offset || 0));
          }
        });
      } catch (error) {
        return;
      }

      bodyClientHeightPatched = true;
    }

    html.classList.add('site-banner-active');
    body.classList.add('site-banner-active');

    var closeButton = banner.querySelector('button');

    function updateLayout() {
      var bannerHeight = banner.offsetHeight;
      var previousOffset = state.offset || 0;
      state.offset = bannerHeight;
      html.style.setProperty('--site-banner-height', bannerHeight + 'px');

      pageRoot = findPageRoot();
      if (!pageRoot) {
        if (bannerHeight !== previousOffset) {
          window.dispatchEvent(new Event('resize'));
        }
        return;
      }

      if (!rootStyleCache || rootStyleCache.element !== pageRoot) {
        if (rootStyleCache && rootStyleCache.element && rootStyleCache.element.isConnected) {
          rootStyleCache.element.style.boxSizing = rootStyleCache.boxSizing;
          rootStyleCache.element.style.marginTop = rootStyleCache.marginTop;
          rootStyleCache.element.style.minHeight = rootStyleCache.minHeight;
          rootStyleCache.element.style.height = rootStyleCache.height;
          rootStyleCache.element.style.maxHeight = rootStyleCache.maxHeight;
        }

        rootStyleCache = {
          element: pageRoot,
          boxSizing: pageRoot.style.boxSizing,
          marginTop: pageRoot.style.marginTop,
          minHeight: pageRoot.style.minHeight,
          height: pageRoot.style.height,
          maxHeight: pageRoot.style.maxHeight
        };
      }

      pageRoot.style.boxSizing = 'border-box';
      pageRoot.style.marginTop = bannerHeight + 'px';
      pageRoot.style.minHeight = 'calc(100vh - ' + bannerHeight + 'px)';
      pageRoot.style.height = 'calc(100vh - ' + bannerHeight + 'px)';
      pageRoot.style.maxHeight = 'calc(100vh - ' + bannerHeight + 'px)';
      pageRoot.style.minHeight = 'calc(100dvh - ' + bannerHeight + 'px)';
      pageRoot.style.height = 'calc(100dvh - ' + bannerHeight + 'px)';
      pageRoot.style.maxHeight = 'calc(100dvh - ' + bannerHeight + 'px)';

      if (bannerHeight !== previousOffset) {
        window.dispatchEvent(new Event('resize'));
      }
    }

    patchBodyClientHeight();
    updateLayout();
    window.addEventListener('resize', updateLayout);

    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(updateLayout);
      resizeObserver.observe(banner);
    }

    function teardown() {
      window.removeEventListener('resize', updateLayout);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      state.offset = 0;
      if (rootStyleCache && rootStyleCache.element && rootStyleCache.element.isConnected) {
        rootStyleCache.element.style.boxSizing = rootStyleCache.boxSizing;
        rootStyleCache.element.style.marginTop = rootStyleCache.marginTop;
        rootStyleCache.element.style.minHeight = rootStyleCache.minHeight;
        rootStyleCache.element.style.height = rootStyleCache.height;
        rootStyleCache.element.style.maxHeight = rootStyleCache.maxHeight;
      }

      html.classList.remove('site-banner-active');
      body.classList.remove('site-banner-active');
      html.style.removeProperty('--site-banner-height');
      banner.remove();
      window.dispatchEvent(new Event('resize'));
    }

    if (!closeButton) {
      return;
    }

    closeButton.addEventListener('click', function () {
      document.cookie = ${cookieName} + '=1; path=/; max-age=' + ${cookieMaxAge} + '; SameSite=Lax; Secure';
      teardown();
    });
  })();
</script>`;

  if (/<head[^>]*>/i.test(text)) {
    text = text.replace(/<head[^>]*>/i, match => `${match}${headMarkup}`);
  } else if (/<html[^>]*>/i.test(text)) {
    text = text.replace(/<html[^>]*>/i, match => `${match}${headMarkup}`);
  } else {
    text = `${headMarkup}${text}`;
  }

  if (/<\/body>/i.test(text)) {
    return text.replace(/<\/body>/i, `${bannerMarkup}</body>`);
  }

  if (/<body[^>]*>/i.test(text)) {
    return text.replace(/<body[^>]*>/i, match => `${match}${bannerMarkup}`);
  }

  return `${text}${bannerMarkup}`;
}
