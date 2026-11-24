#!/usr/bin/env node
// Mise recipe collector.
// For each chef source it reads robots.txt, walks the site's sitemaps for recipe pages under the
// chef's own path, and saves the recipe's public facts (title, time, rating, video) plus the link.
// It never stores ingredients, steps, photos or any other recipe text.
//
// Usage: node scripts/crawl.mjs [--max-new 25] [--only ina,giada] [--dry-run]
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { factsFromHtml } from './lib/jsonld.mjs';
import { parseRobots, isAllowed } from './lib/robots.mjs';
import { parseSitemap } from './lib/sitemap.mjs';
import { deriveTags } from './lib/tags.mjs';

const ROOT = new URL('..', import.meta.url);
const CHEFS = new URL('public/data/chefs.json', ROOT);
const RECIPES = new URL('public/data/recipes.json', ROOT);
const UA = 'MiseBot/0.1 (+https://github.com/rhiannaferreira/Mise; links back to every recipe)';
const MIN_DELAY_MS = 2500;
const MAX_SITEMAPS = 40;

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const MAX_NEW = Number(opt('--max-new', 25));
const ONLY = opt('--only', '') ? new Set(opt('--only').split(',')) : null;
const DRY = args.includes('--dry-run');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const lastHit = new Map();

async function politeGet(url, delayMs) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + delayMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return url.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
}

async function recipeUrlsFor(source, robots, delay) {
  const want = `https://${source.host}${source.pathPrefix}`;
  const queue = robots.sitemaps.length ? [...robots.sitemaps] : [`https://${source.host}/sitemap.xml`];
  // Sitemaps that mention recipes go first, since big sites split by section.
  const score = u => (/recipe/i.test(u) ? 0 : 1);
  const found = new Set();
  let seen = 0;
  while (queue.length && seen < MAX_SITEMAPS) {
    queue.sort((a, b) => score(a) - score(b));
    const sm = queue.shift();
    seen++;
    let xml;
    try { xml = await politeGet(sm, delay); } catch (e) { console.warn('  sitemap skipped:', e.message); continue; }
    const { isIndex, locs } = parseSitemap(xml);
    if (isIndex) queue.push(...locs.filter(l => new URL(l).host === source.host));
    else for (const l of locs) if (l.startsWith(want) && l.length > want.length) found.add(l.split('#')[0]);
  }
  return [...found].filter(u => isAllowed(robots, new URL(u).pathname));
}

function upsert(recipes, entry) {
  const i = recipes.findIndex(r => r.url === entry.url);
  if (i >= 0) recipes[i] = { ...recipes[i], ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v != null)) };
  else recipes.push(entry);
}

async function main() {
  const chefs = JSON.parse(await readFile(CHEFS, 'utf8'));
  const recipes = JSON.parse(await readFile(RECIPES, 'utf8'));
  const known = new Set(recipes.map(r => r.url));
  const today = new Date().toISOString().slice(0, 10);
  let added = 0, refreshed = 0;

  for (const chef of chefs) {
    if (ONLY && !ONLY.has(chef.id)) continue;
    for (const source of chef.sources) {
      console.log(`${chef.name} · ${source.host}${source.pathPrefix}`);
      let robots;
      try { robots = parseRobots(await politeGet(`https://${source.host}/robots.txt`, MIN_DELAY_MS)); }
      catch { robots = { rules: [], delay: null, sitemaps: [] }; }
      const delay = Math.max(MIN_DELAY_MS, (robots.delay ?? 0) * 1000);

      // 1. Fill in facts for links we already have but have never checked.
      const stale = recipes.filter(r => r.chef === chef.id && !r.checkedAt && r.url.includes(source.host + source.pathPrefix));
      // 2. Discover new recipe pages from the sitemap.
      let fresh = [];
      try { fresh = (await recipeUrlsFor(source, robots, delay)).filter(u => !known.has(u)).slice(0, MAX_NEW); }
      catch (e) { console.warn('  discovery failed:', e.message); }
      console.log(`  ${stale.length} to check, ${fresh.length} new`);

      for (const url of [...stale.map(r => r.url), ...fresh]) {
        if (!isAllowed(robots, new URL(url).pathname)) continue;
        let facts;
        try { facts = factsFromHtml(await politeGet(url, delay)); } catch (e) { console.warn('  skip', e.message); continue; }
        if (!facts?.title) continue; // not a recipe page
        const isNew = !known.has(url);
        upsert(recipes, {
          url, chef: chef.id, source: source.label, title: facts.title,
          tags: deriveTags(facts.title, facts.keywords),
          totalMinutes: facts.totalMinutes, rating: facts.rating, ratingCount: facts.ratingCount,
          hasVideo: facts.hasVideo, origin: isNew ? 'collected' : undefined, checkedAt: today,
        });
        known.add(url);
        isNew ? added++ : refreshed++;
      }
    }
  }

  recipes.sort((a, b) => a.chef.localeCompare(b.chef) || a.title.localeCompare(b.title));
  console.log(`Done: ${added} new, ${refreshed} refreshed, ${recipes.length} total.`);
  if (!DRY) await writeFile(RECIPES, JSON.stringify(recipes, null, 1) + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
