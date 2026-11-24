import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, isAllowed } from '../scripts/lib/robots.mjs';
import { parseSitemap } from '../scripts/lib/sitemap.mjs';

const TXT = `
User-agent: *
Disallow: /search
Disallow: /recipes/*/print$
Allow: /search/about
Crawl-delay: 5

User-agent: BadBot
Disallow: /

Sitemap: https://example.com/sitemap-index.xml
`;

test('follows the general rules when nothing names us', () => {
  const r = parseRobots(TXT);
  assert.equal(r.delay, 5);
  assert.deepEqual(r.sitemaps, ['https://example.com/sitemap-index.xml']);
  assert.equal(isAllowed(r, '/recipes/ina-garten/roast-chicken'), true);
  assert.equal(isAllowed(r, '/search?q=x'), false);
  assert.equal(isAllowed(r, '/search/about'), true);
  assert.equal(isAllowed(r, '/recipes/x/print'), false);
  assert.equal(isAllowed(r, '/recipes/x/print-more'), true);
});

test('obeys a group addressed to MiseBot', () => {
  const r = parseRobots('User-agent: MiseBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n');
  assert.equal(isAllowed(r, '/anything'), false);
});

test('reads sitemap indexes and url sets', () => {
  const idx = parseSitemap('<sitemapindex><sitemap><loc>https://e.com/a.xml</loc></sitemap></sitemapindex>');
  assert.equal(idx.isIndex, true);
  assert.deepEqual(idx.locs, ['https://e.com/a.xml']);
  const set = parseSitemap('<urlset><url><loc><![CDATA[ https://e.com/r?a=1&amp;b=2 ]]></loc></url></urlset>');
  assert.equal(set.isIndex, false);
  assert.deepEqual(set.locs, ['https://e.com/r?a=1&b=2']);
});
