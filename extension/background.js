function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200000);
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      credentials: 'omit',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { url, ok: false, text: '' };
    const text = htmlToText(await response.text());
    return { url, ok: text.length > 80, text };
  } catch {
    return { url, ok: false, text: '' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'fetch-pages') return;
  const urls = [...new Set(message.urls || [])].slice(0, 8);
  Promise.all(urls.map(fetchPage)).then((pages) => sendResponse({ pages }));
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'analyse' });
});
