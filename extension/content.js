const ANSWER_SELECTORS = [
  '[data-message-author-role="assistant"]',
  'message-content',
  '.model-response-text',
  '.ds-markdown',
  '.markdown',
  '[class*="prose"]',
];

const panel = document.createElement('div');
panel.id = 'ai-answer-analyser-root';
const shadow = panel.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    :host, * { box-sizing: border-box; }
    .panel {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 360px;
      max-height: calc(100vh - 32px);
      overflow: auto;
      z-index: 2147483646;
      background: #ffffff;
      color: #1d1d1f;
      border: 1px solid #d2d2d7;
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
      font: 13px/1.45 system-ui, sans-serif;
      padding: 14px;
    }
    h2 { margin: 0; font-size: 15px; }
    .row { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    button {
      border: 0;
      background: #1d1d1f;
      color: white;
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
      font: inherit;
    }
    button.ghost { background: transparent; color: #1d1d1f; }
    .status { color: #6e6e73; margin: 8px 0; }
    .finding { border-top: 1px solid #ececef; padding: 10px 0; }
    .quote { margin: 0 0 6px; }
    .badges { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
    .badge { border-radius: 99px; padding: 2px 8px; font-size: 11px; }
    .supported { background: #e5f8ec; color: #137333; }
    .contradicted { background: #fde8e6; color: #b3261e; }
    .unchecked { background: #f2f2f4; color: #555; }
    .promo { background: #fff4e0; color: #8a5a00; }
    a { color: #0b57d0; word-break: break-all; }
    .reason { margin: 4px 0 0; color: #3c3c43; }
  </style>
  <section class="panel">
    <div class="row">
      <h2>AI Answer Analyser</h2>
      <button class="ghost" id="close" type="button">Close</button>
    </div>
    <p class="status" id="status">Waiting for an answer with citation links.</p>
    <button id="run" type="button">Analyse again</button>
    <div id="findings"></div>
  </section>
`;
document.documentElement.appendChild(panel);

const statusEl = shadow.getElementById('status');
const findingsEl = shadow.getElementById('findings');
shadow.getElementById('close').addEventListener('click', () => {
  panel.style.display = 'none';
});
shadow.getElementById('run').addEventListener('click', () => analyseNow());

let lastKey = '';
let timer = 0;
let running = false;

function unwrapUrl(href) {
  try {
    const url = new URL(href, location.href);
    for (const key of ['url', 'q', 'u', 'redirect', 'target']) {
      const value = url.searchParams.get(key);
      if (value && /^https?:\/\//i.test(value)) return value;
    }
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function citationsFrom(root) {
  const urls = [];
  root.querySelectorAll('a[href]').forEach((link) => {
    const href = unwrapUrl(link.href);
    if (!href) return;
    try {
      if (new URL(href).hostname === location.hostname) return;
    } catch {
      return;
    }
    urls.push(href);
  });
  return [...new Set(urls)];
}

function sentencesFrom(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 40);
}

function answerRoot() {
  const selected = window.getSelection();
  const selectedText = selected ? selected.toString().trim() : '';
  if (selectedText.length >= 40) {
    const anchorNode = selected.anchorNode;
    const anchor = anchorNode
      ? anchorNode.nodeType === 1
        ? anchorNode
        : anchorNode.parentElement
      : null;
    const block = anchor ? anchor.closest('p, li, div') || anchor : null;
    return { node: anchor, text: selectedText, citations: block ? citationsFrom(block) : [] };
  }

  for (const selector of ANSWER_SELECTORS) {
    const nodes = [...document.querySelectorAll(selector)].filter((node) => !panel.contains(node) && node.innerText.trim().length > 80);
    if (nodes.length) return { node: nodes[nodes.length - 1] };
  }
  return null;
}

function collectSentences() {
  const answer = answerRoot();
  if (!answer) return [];
  if (answer.text) {
    const citations = answer.citations.length ? answer.citations : citationsFrom(document.body);
    return sentencesFrom(answer.text).map((text) => ({ text, citations }));
  }

  const blocks = [...answer.node.querySelectorAll('p, li')].filter((node) => node.innerText.trim().length >= 40);
  const fallbackCitations = citationsFrom(answer.node);
  const sources = blocks.length ? blocks : [answer.node];
  const sentences = [];
  for (const block of sources) {
    const ownCitations = citationsFrom(block);
    const citations = ownCitations.length ? ownCitations : fallbackCitations;
    for (const text of sentencesFrom(block.innerText)) {
      sentences.push({ text, citations });
    }
  }
  return sentences.slice(0, 12);
}

function badge(className, label) {
  const span = document.createElement('span');
  span.className = `badge ${className}`;
  span.textContent = label;
  return span;
}

function render(findings) {
  findingsEl.replaceChildren();
  for (const finding of findings) {
    const item = document.createElement('article');
    item.className = 'finding';
    const quote = document.createElement('p');
    quote.className = 'quote';
    quote.textContent = finding.text;
    const badges = document.createElement('div');
    badges.className = 'badges';
    const factLabel = finding.fact === 'contradicted' ? 'False' : finding.fact === 'supported' ? 'Supported' : 'Unchecked';
    badges.append(badge(finding.fact, factLabel));
    if (finding.selfPromotion) badges.append(badge('promo', 'Self-promotion'));
    const reason = document.createElement('p');
    reason.className = 'reason';
    reason.textContent = [finding.factReason, finding.selfPromotionReason].filter(Boolean).join(' ');
    item.append(quote, badges, reason);
    if (finding.citation) {
      const link = document.createElement('a');
      link.href = finding.citation;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = finding.citation;
      item.append(link);
    }
    findingsEl.append(item);
  }
}

async function analyseNow() {
  if (running) return;
  panel.style.display = '';
  const sentences = collectSentences();
  if (!sentences.length) {
    statusEl.textContent = 'No answer text found. Select the answer, then click Analyse again.';
    findingsEl.replaceChildren();
    return;
  }
  const urls = [...new Set(sentences.flatMap((sentence) => sentence.citations))];
  if (!urls.length) {
    statusEl.textContent = 'This answer has no citation links to check.';
    findingsEl.replaceChildren();
    return;
  }

  running = true;
  statusEl.textContent = `Reading ${urls.length} cited page${urls.length === 1 ? '' : 's'}…`;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'fetch-pages', urls });
    const pages = {};
    for (const page of response.pages || []) pages[page.url] = page;
    const { findings } = analyseAnswer({ sentences, pages });
    const falseCount = findings.filter((finding) => finding.fact === 'contradicted').length;
    const promoCount = findings.filter((finding) => finding.selfPromotion).length;
    statusEl.textContent = `${findings.length} claims. ${falseCount} false. ${promoCount} self-promotion.`;
    render(findings);
    lastKey = sentences.map((sentence) => sentence.text).join('\n');
  } catch (error) {
    statusEl.textContent = 'The check could not finish. Reload the page and try again.';
  } finally {
    running = false;
  }
}

function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const sentences = collectSentences();
    const key = sentences.map((sentence) => sentence.text).join('\n');
    if (!key || key === lastKey || !sentences.some((sentence) => sentence.citations.length)) return;
    analyseNow();
  }, 1500);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'analyse') analyseNow();
});

const observer = new MutationObserver(() => schedule());
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
schedule();
