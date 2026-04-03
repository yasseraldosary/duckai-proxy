export function injectScriptTag(text, scriptTag, scriptId, target = 'head-start') {
  if (scriptId && text.includes(`id="${scriptId}"`)) {
    return text;
  }

  if (target === 'head-start' && /<head[^>]*>/i.test(text)) {
    return text.replace(/<head[^>]*>/i, match => `${match}\n${scriptTag}`);
  }

  if (target === 'body-end' && /<\/body>/i.test(text)) {
    return text.replace(/<\/body>/i, `${scriptTag}</body>`);
  }

  if (/<body[^>]*>/i.test(text)) {
    return text.replace(/<body[^>]*>/i, match => `${match}\n${scriptTag}`);
  }

  if (/<\/html>/i.test(text)) {
    return text.replace(/<\/html>/i, `${scriptTag}</html>`);
  }

  return `${scriptTag}${text}`;
}
