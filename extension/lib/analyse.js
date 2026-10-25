const STOP_WORDS = new Set(
  'that this with from they them their your have been were into over also just than then when what which while about after before says said say according teams there their would could should'.split(
    ' '
  )
);

function hostLabel(hostname) {
  const parts = hostname.replace(/^www\./i, '').split('.');
  if (parts.length >= 3 && parts.at(-2).length <= 3 && parts.at(-1).length <= 2) {
    return parts.at(-3);
  }
  return parts.length >= 2 ? parts.at(-2) : parts[0];
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function selfPromotion(text, citations) {
  const branded = text.match(/\b[A-Z][A-Za-z0-9]{2,}\b/g) || [];
  for (const url of citations) {
    const hostname = hostnameOf(url);
    if (!hostname) continue;
    const label = hostLabel(hostname);
    const hit = branded.find((word) => word.toLowerCase() === label);
    if (hit && label.length >= 3) {
      return {
        selfPromotion: true,
        selfPromotionReason: `The passage promotes ${hit} and cites ${hostname}.`,
      };
    }
  }
  return { selfPromotion: false, selfPromotionReason: '' };
}

function extractNumbers(text) {
  const numbers = [];
  const pattern = /(\d+(?:\.\d+)?)\s*(%|percent)?/gi;
  let match = pattern.exec(text);
  while (match) {
    numbers.push({ value: Number(match[1]), percent: Boolean(match[2]) });
    match = pattern.exec(text);
  }
  return numbers;
}

function sameNumber(left, right) {
  return left.value === right.value && left.percent === right.percent;
}

function formatNumber(number) {
  return number.percent ? `${number.value}%` : String(number.value);
}

function contentWords(text) {
  return (text.toLowerCase().match(/[a-z][a-z0-9]{3,}/g) || []).filter((word) => !STOP_WORDS.has(word));
}

function factStatus(sentence, page) {
  if (!page || !page.ok || !page.text) {
    return { fact: 'unchecked', factReason: 'The cited page could not be read.' };
  }

  const claimNumbers = extractNumbers(sentence);
  const pageNumbers = extractNumbers(page.text);
  const claimWords = contentWords(sentence);
  const pageWords = new Set(contentWords(page.text));
  const shared = claimWords.filter((word) => pageWords.has(word));
  const ratio = claimWords.length ? shared.length / claimWords.length : 0;
  const missing = claimNumbers.filter((number) => !pageNumbers.some((pageNumber) => sameNumber(number, pageNumber)));
  const extra = pageNumbers.filter((number) => !claimNumbers.some((claimNumber) => sameNumber(number, claimNumber)));

  if (claimNumbers.length && missing.length && extra.length && shared.length) {
    const shown = extra.find((number) => number.percent) || extra[0];
    const missed = missing.find((number) => number.percent) || missing[0];
    return {
      fact: 'contradicted',
      factReason: `The cited page says ${formatNumber(shown)}, not ${formatNumber(missed)}.`,
    };
  }

  if (claimNumbers.length && missing.length === 0 && shared.length > 0) {
    return { fact: 'supported', factReason: 'The cited page states this figure.' };
  }

  if (!claimNumbers.length && ratio >= 0.5) {
    return { fact: 'supported', factReason: 'The cited page states this claim.' };
  }

  return { fact: 'unchecked', factReason: 'The cited page does not mention this claim.' };
}

function analyseAnswer({ sentences, pages }) {
  const rank = { contradicted: 3, supported: 2, unchecked: 1 };
  const findings = sentences.map((sentence, index) => {
    const citations = sentence.citations || [];
    let best = {
      fact: 'unchecked',
      factReason: 'This sentence has no citation.',
      citation: '',
    };

    for (const url of citations) {
      const status = factStatus(sentence.text, pages[url]);
      if (!best.citation || rank[status.fact] >= rank[best.fact]) {
        best = { ...status, citation: url };
      }
    }

    return {
      index,
      text: sentence.text,
      citation: best.citation,
      fact: best.fact,
      factReason: best.factReason,
      ...selfPromotion(sentence.text, citations),
    };
  });

  return { findings };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { analyseAnswer };
}
