#!/usr/bin/env node
// Mise recipe collector.
// For each chef source it reads robots.txt, walks the site's sitemaps for recipe pages under the
// chef's own path, and saves the recipe's public facts (title, time, rating, video) plus the link.
// It never stores ingredients, steps, photos or any other recipe text.
//
// Usage: node scripts/crawl.mjs [--max-new 25] [--only ina,giada] [--dry-run] [--no-refresh]
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { factsFromHtml } from './lib/jsonld.mjs';
import { parseRobots, isAllowed } from './lib/robots.mjs';
import { parseSitemap } from './lib/sitemap.mjs';
import { deriveTags } from './lib/tags.mjs';
import { guessCourse, guessCuisine } from '../src/categories.js';
import { guessLevel } from '../src/difficulty.js';

const ROOT = new URL('..', import.meta.url);
const CHEFS = new URL('public/data/chefs.json', ROOT);
const RECIPES = new URL('public/data/recipes.json', ROOT);
const UA = 'MiseBot/0.1 (+https://github.com/rhiannaferreira/Mise; links back to every recipe)';
const MIN_DELAY_MS = 2500;
const MAX_SITEMAPS = 80;

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const MAX_NEW = Number(opt('--max-new', 25));
const ONLY = opt('--only', '') ? new Set(opt('--only').split(',')) : null;
const DRY = args.includes('--dry-run');
const REFRESH = !args.includes('--no-refresh');

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

// Several chefs share a host (Food Network), so each host's sitemaps are walked once.
const sitemapCache = new Map();

async function recipeUrlsFor(source, robots, delay) {
  const want = `https://${source.host}${source.pathPrefix}`;
  if (!sitemapCache.has(source.host)) sitemapCache.set(source.host, await allSitemapUrls(source, robots, delay));
  return sitemapCache.get(source.host)
    .filter(l => l.startsWith(want) && l.length > want.length)
    .filter(u => isAllowed(robots, new URL(u).pathname));
}

async function allSitemapUrls(source, robots, delay) {
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
    else for (const l of locs) if (/recipe/i.test(l)) found.add(l.split('#')[0]);
  }
  return [...found];
}

// Picks new pages spread across the whole catalogue, not just the first ones listed, and puts
// everyday "easy weeknight" pages last so the index leans toward dishes worth discovering.
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const PLAIN = /\b(easy|quick|simple|5-ingredient|basic|weeknight|copycat|semi-homemade)\b/i;
function pickVaried(urls, n, salt) {
  return [...urls]
    .sort((a, b) => (PLAIN.test(a) - PLAIN.test(b)) || hash(salt + a) - hash(salt + b))
    .slice(0, n);
}

// Mise is for dishes. Drinks, syrups and infused vinegars are skipped.
const NOT_A_DISH = /\b(cocktail|mocktail|martini|margarita|spritz(er)?|sangria|cosmos?|caipiroska|michelada|mimosa|mumosa|negroni|julep|punch|smoothie|juice|lemonade|vodka|gin|be-gin|liqueur|vinegar|syrup|bitters|shrub|latte|tea)\b/i;
function isNotADish(f) {
  return NOT_A_DISH.test(f.title) || (f.category || []).some(c => /\b(drink|drinks|cocktail|beverage)s?\b/.test(c));
}

let lastHtml = '';

// A few chefs' own sites (Lidia, Rick Bayless, Nigella) don't publish recipe data for search
// engines. For those we keep just the page title and link, and estimate the level from the dish.
function titleOnlyFacts(html, url, source) {
  const slug = new URL(url).pathname.slice(source.pathPrefix.length).replace(/\/$/, '');
  if (!slug || slug.includes('/')) return null; // a listing page, not a recipe
  const raw = (html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || html.match(/<title>([^<]+)/i) || [])[1];
  if (!raw) return null;
  const title = decodeHtml(raw).split(/\s+[|–—-]\s+/)[0].trim();
  if (!title || /\brecipes\b/i.test(title) || title.length > 90) return null;
  const pretty = title === title.toUpperCase() ? title.toLowerCase().replace(/(^|[\s(-])\p{L}/gu, m => m.toUpperCase()) : title;
  return { title: pretty, keywords: [], totalMinutes: null, rating: null, ratingCount: null, hasVideo: null, level: null, category: [] };
}
const decodeHtml = s => s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, '\u2019').replace(/&quot;/g, '"').replace(/&#8211;|&ndash;/g, '\u2013').replace(/\s+/g, ' ');
function diagnose(html) {
  const ld = [...html.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]{0,4000}?)<\/script>/gi)].map(m => (m[1].match(/"@type"\s*:\s*("[^"]+"|\[[^\]]+\])/g) || []).join(',')).join(' ; ');
  return `${html.length} bytes; ld+json types: ${ld || 'none'}; microdata recipe: ${/itemtype=["'][^"']*schema\.org\/Recipe/i.test(html)}; title: ${(html.match(/<title>([^<]{0,80})/i) || [])[1]}`;
}

async function robotsFor(host) {
  try { return parseRobots(await politeGet(`https://${host}/robots.txt`, MIN_DELAY_MS)); }
  catch { return { rules: [], delay: null, sitemaps: [] }; }
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
      const robots = await robotsFor(source.host);
      const delay = Math.max(MIN_DELAY_MS, (robots.delay ?? 0) * 1000);

      // 1. Fill in facts for links we already have but have never checked.
      const stale = recipes.filter(r => r.chef === chef.id && !r.checkedAt && r.url.includes(source.host + source.pathPrefix));
      // 2. Discover new recipe pages from the sitemap.
      let fresh = [];
      try { fresh = pickVaried((await recipeUrlsFor(source, robots, delay)).filter(u => !known.has(u)), MAX_NEW, today.slice(0, 7)); }
      catch (e) { console.warn('  discovery failed:', e.message); }
      console.log(`  ${stale.length} to check, ${fresh.length} new`);

      for (const url of [...stale.map(r => r.url), ...fresh]) {
        if (!isAllowed(robots, new URL(url).pathname)) continue;
        let facts;
        try { lastHtml = await politeGet(url, delay); facts = factsFromHtml(lastHtml); } catch (e) { console.warn('  skip', e.message); continue; }
        if (!facts?.title && source.titleOnly) facts = titleOnlyFacts(lastHtml, url, source);
        if (!facts?.title) { console.warn('  no recipe data:', url, diagnose(lastHtml)); continue; } // not a recipe page
        if (isNotADish(facts)) { known.add(url); continue; }
        if (recipes.some(r => r.chef === chef.id && r.title.toLowerCase() === facts.title.toLowerCase() && r.url !== url)) { known.add(url); continue; }
        const isNew = !known.has(url);
        upsert(recipes, {
          url, chef: chef.id, source: source.label, title: facts.title,
          tags: deriveTags(facts.title, facts.keywords),
          totalMinutes: facts.totalMinutes, rating: facts.rating, ratingCount: facts.ratingCount,
          hasVideo: facts.hasVideo, level: facts.level ?? guessLevel(facts.title, facts.totalMinutes), origin: isNew ? 'collected' : undefined, checkedAt: today,
          // Hand-picked recipes keep the course and cuisine we gave them.
          course: isNew ? guessCourse(facts.title, facts.keywords) : undefined,
          cuisine: isNew ? guessCuisine(facts.title, facts.keywords, chef.cuisine) : undefined,
        });
        known.add(url);
        isNew ? added++ : refreshed++;
      }
    }
  }

  // 3. Read hand-picked links on other sites (news features, PBS, magazines) that were never checked.
  if (REFRESH && !ONLY) {
    const byHost = new Map();
    for (const r of recipes) if (!r.checkedAt) byHost.set(new URL(r.url).host, [...(byHost.get(new URL(r.url).host) ?? []), r]);
    for (const [host, list] of byHost) {
      const robots = await robotsFor(host);
      const delay = Math.max(MIN_DELAY_MS, (robots.delay ?? 0) * 1000);
      for (const r of list) {
        if (!isAllowed(robots, new URL(r.url).pathname)) continue;
        let facts;
        try { facts = factsFromHtml(await politeGet(r.url, delay)); } catch (e) { console.warn('  skip', e.message); continue; }
        if (!facts?.title) continue;
        upsert(recipes, { url: r.url, totalMinutes: facts.totalMinutes, rating: facts.rating, ratingCount: facts.ratingCount, hasVideo: facts.hasVideo, level: facts.level, checkedAt: today });
        refreshed++;
      }
    }
  }

  // Every recipe gets a level; pages that told us nothing get a careful guess from the dish.
  for (const r of recipes) if (!r.level) r.level = guessLevel(r.title, r.totalMinutes);

  recipes.sort((a, b) => a.chef.localeCompare(b.chef) || a.title.localeCompare(b.title));
  console.log(`Done: ${added} new, ${refreshed} refreshed, ${recipes.length} total.`);
  if (!DRY) await writeFile(RECIPES, JSON.stringify(recipes, null, 1) + '\n');
}

main().catch(e => { console.error(e); process.exit(1); });
