const test = require('node:test');
const assert = require('node:assert/strict');
const { analyseAnswer } = require('../extension/lib/analyse.js');

const acmeUrl = 'https://acme.com/blog/reliability-2025';

test('marks a same-domain brand citation as self-promotion and a matching fact as supported', () => {
  const result = analyseAnswer({
    sentences: [
      {
        text: 'Acme Cloud cut outage time by 40% in 2025.',
        citations: [acmeUrl],
      },
    ],
    pages: {
      [acmeUrl]: {
        ok: true,
        text: 'Acme Cloud cut outage time by 40% in 2025, according to its status report.',
      },
    },
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].fact, 'supported');
  assert.equal(result.findings[0].selfPromotion, true);
  assert.match(result.findings[0].selfPromotionReason, /acme\.com/i);
});

test('marks a claim false when the cited page states a different number', () => {
  const result = analyseAnswer({
    sentences: [
      {
        text: 'Acme Cloud cut outage time by 40% in 2025.',
        citations: [acmeUrl],
      },
    ],
    pages: {
      [acmeUrl]: {
        ok: true,
        text: 'Acme Cloud cut outage time by 12% in 2025.',
      },
    },
  });

  assert.equal(result.findings[0].fact, 'contradicted');
  assert.match(result.findings[0].factReason, /12%/);
  assert.equal(result.findings[0].selfPromotion, true);
});

test('leaves a claim unchecked when the cited page never mentions it', () => {
  const result = analyseAnswer({
    sentences: [
      {
        text: 'Teams that moved from RivalHost say deploys got faster.',
        citations: [acmeUrl],
      },
    ],
    pages: {
      [acmeUrl]: {
        ok: true,
        text: 'Acme Cloud cut outage time by 12% in 2025.',
      },
    },
  });

  assert.equal(result.findings[0].fact, 'unchecked');
  assert.equal(result.findings[0].selfPromotion, false);
});

test('leaves a claim unchecked when the cited page cannot be read', () => {
  const result = analyseAnswer({
    sentences: [
      {
        text: 'Acme Cloud cut outage time by 40% in 2025.',
        citations: [acmeUrl],
      },
    ],
    pages: {
      [acmeUrl]: { ok: false, text: '' },
    },
  });

  assert.equal(result.findings[0].fact, 'unchecked');
  assert.equal(result.findings[0].selfPromotion, true);
});

test('does not call a citation self-promotion when the domain is a different site', () => {
  const reviewUrl = 'https://www.wirecutter.com/reviews/cloud-hosts/';
  const result = analyseAnswer({
    sentences: [
      {
        text: 'Acme Cloud cut outage time by 40% in 2025.',
        citations: [reviewUrl],
      },
    ],
    pages: {
      [reviewUrl]: {
        ok: true,
        text: 'Acme Cloud cut outage time by 40% in 2025.',
      },
    },
  });

  assert.equal(result.findings[0].fact, 'supported');
  assert.equal(result.findings[0].selfPromotion, false);
});

test('treats "12 percent" on the page as the same figure as 12%', () => {
  const result = analyseAnswer({
    sentences: [
      {
        text: 'Acme Cloud cut outage time by 12% in 2025.',
        citations: [acmeUrl],
      },
    ],
    pages: {
      [acmeUrl]: {
        ok: true,
        text: 'Acme Cloud cut outage time by 12 percent in 2025.',
      },
    },
  });

  assert.equal(result.findings[0].fact, 'supported');
});
