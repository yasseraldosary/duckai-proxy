const upstream = 'duck.ai'; // Replace here

const upstream_mobile = 'duck.ai'; // Replace here

const blocked_region = [''];

const blocked_ip_address = ['127.0.0.1'];

const replace_dict = {
  '$upstream': '$custom_domain', // Replace here
  '//duck.ai': ''
};

addEventListener('fetch', event => {
  event.respondWith(fetchAndApply(event.request));
});

async function fetchAndApply(request) {
  const region = (request.headers.get('cf-ipcountry') || '').toUpperCase();
  const ip_address = request.headers.get('cf-connecting-ip') || '';
  const user_agent = request.headers.get('user-agent') || '';

  let response = null;
  let url = new URL(request.url);
  let url_host = url.host;

  if (url.protocol == 'http:') {
    url.protocol = 'https:';
    response = Response.redirect(url.href);
    return response;
  }

  if (await device_status(user_agent)) {
    var upstream_domain = upstream;
  } else {
    var upstream_domain = upstream_mobile;
  }

  url.host = upstream_domain;
  url.protocol = 'https:';

  if (blocked_region.includes(region)) {
    response = new Response('Access denied: WorkersProxy is not available in your region yet.', {
      status: 403
    });
  } else if (blocked_ip_address.includes(ip_address)){
    response = new Response('Access denied: Your IP address is blocked by WorkersProxy.', {
      status: 403
    });
  } else if (request.method === 'OPTIONS') {
    response = new Response(null, {
      status: 204,
      headers: build_cors_headers(request)
    });
  } else {
    const new_request_headers = build_request_headers(request, upstream_domain);
    const request_init = {
      method: request.method,
      headers: new_request_headers,
      redirect: 'manual'
    };

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      request_init.body = request.body;
    }

    let original_response = await fetch(url.href, request_init);

    let original_response_clone = original_response.clone();
    let original_text = null;
    let response_headers = original_response.headers;
    let new_response_headers = new Headers(response_headers);
    let status = original_response.status;

    apply_cors_headers(new_response_headers, request);
    new_response_headers.delete('content-security-policy');
    new_response_headers.delete('content-security-policy-report-only');
    new_response_headers.delete('clear-site-data');

    const content_type = new_response_headers.get('content-type');
    if (content_type && content_type.toLowerCase().includes('text/html')) {
      original_text = await replace_response_text(original_response_clone, upstream_domain, url_host); // 替换响应中的文本内容
    } else {
      original_text = original_response_clone.body;
    }

    response = new Response(original_text, {
      status,
      headers: new_response_headers
    });
  }
  return response;
}

function build_request_headers(request, upstream_domain) {
  const new_request_headers = new Headers(request.headers);
  const request_origin = new URL(request.url).origin;
  const normalized_upstream_origin = `https://${upstream_domain}`;

  new_request_headers.set('Host', upstream_domain);
  new_request_headers.set('Origin', normalized_upstream_origin);
  new_request_headers.set('Referer', `${normalized_upstream_origin}/`);
  new_request_headers.set('Sec-Fetch-Site', 'same-origin');
  new_request_headers.delete('Content-Length');

  normalize_vqd_header(new_request_headers, request_origin, normalized_upstream_origin);

  return new_request_headers;
}

function normalize_vqd_header(headers, request_origin, upstream_origin_override) {
  const vqd_header = headers.get('X-Vqd-Hash-1');
  if (!vqd_header) {
    return;
  }

  try {
    const decoded = JSON.parse(atob(vqd_header));

    if (decoded.meta && typeof decoded.meta === 'object') {
      if (typeof decoded.meta.origin === 'string') {
        decoded.meta.origin = upstream_origin_override;
      }

      if (typeof decoded.meta.stack === 'string') {
        decoded.meta.stack = decoded.meta.stack.replaceAll(request_origin, upstream_origin_override);
      }
    }

    headers.set('X-Vqd-Hash-1', btoa(JSON.stringify(decoded)));
  } catch (error) {
    // empty
  }
}

function build_cors_headers(request) {
  const headers = new Headers();
  apply_cors_headers(headers, request);
  return headers;
}

function apply_cors_headers(headers, request) {
  const request_origin = request.headers.get('Origin');

  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Headers', request.headers.get('Access-Control-Request-Headers') || '*');
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Origin', request_origin || '*');
  headers.append('Vary', 'Origin');
}

async function replace_response_text(response, upstream_domain, host_name) {
  let text = await response.text();

  for (let i in replace_dict) {
    let j = replace_dict[i];
    if (i == '$upstream') {
      i = upstream_domain;
    } else if (i == '$custom_domain') {
      i = host_name;
    }

    if (j == '$upstream') {
      j = upstream_domain;
    } else if (j == '$custom_domain') {
      j = host_name;
    }

    let re = new RegExp(i, 'g');
    text = text.replace(re, j);
  }

  return text;
}

async function device_status(user_agent_info) {
  var agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"];
  var flag = true;
  for (var v = 0; v < agents.length; v++) {
    if (user_agent_info.indexOf(agents[v]) > -1) {
      flag = false;
      break;
    }
  }
  return flag;
}
