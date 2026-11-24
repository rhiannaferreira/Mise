// Small robots.txt reader: which paths we may fetch, how slowly, and where the sitemaps are.

export function parseRobots(txt, agent = 'misebot') {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;
  for (const line of txt.split(/\r?\n/)) {
    const clean = line.replace(/#.*/, '').trim();
    const i = clean.indexOf(':');
    if (i < 0) continue;
    const key = clean.slice(0, i).trim().toLowerCase();
    const value = clean.slice(i + 1).trim();
    if (key === 'sitemap') { if (value) sitemaps.push(value); continue; }
    if (key === 'user-agent') {
      if (!lastWasAgent) { current = { agents: [], rules: [], delay: null }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') current.rules.push({ allow: key === 'allow', path: value });
    if (key === 'crawl-delay') current.delay = Number(value) || null;
  }
  const mine = groups.find(g => g.agents.some(a => a !== '*' && agent.includes(a)))
    || groups.find(g => g.agents.includes('*'))
    || { rules: [], delay: null };
  return { rules: mine.rules, delay: mine.delay, sitemaps };
}

function ruleMatches(rulePath, path) {
  if (!rulePath) return false;
  const anchored = rulePath.endsWith('$');
  const body = (anchored ? rulePath.slice(0, -1) : rulePath)
    .split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + body + (anchored ? '$' : '')).test(path);
}

export function isAllowed(robots, path) {
  let best = null;
  for (const r of robots.rules) {
    if (!ruleMatches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}
