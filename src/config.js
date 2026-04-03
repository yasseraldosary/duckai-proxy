import bannerHtml from './banner.html';

export const config = {
  upstream: 'duck.ai',
  upstreamMobile: 'duck.ai',
  blockedRegions: [''],
  blockedIpAddresses: ['127.0.0.1'],
  bannerHtml: bannerHtml,
  bannerCookieName: 'banner_closed',
  bannerCookieMaxAge: 60 * 60 * 24 * 365,
  replaceMap: {
    '$upstream': '$custom_domain',
    '//duck.ai': ''
  }
};
