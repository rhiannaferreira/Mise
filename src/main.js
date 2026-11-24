import { search, formatMinutes, webSearchUrl, videoSearchUrl, norm } from './search.js';

const CRAVINGS = ['Carbonara', 'Chicken soup', 'Roast chicken', 'Burgers', 'Salmon', 'Curry', 'Mac and cheese', 'Bolognese', 'Steak', 'Brownies'];
const BOOK_KEY = 'mise.cookbook';

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = name => name.replace(/^J\. /, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('');

const store = {
  read() { try { return new Set(JSON.parse(localStorage.getItem(BOOK_KEY)) || []); } catch { return new Set(); } },
  write(set) { try { localStorage.setItem(BOOK_KEY, JSON.stringify([...set])); } catch { /* private mode */ } },
};

const state = { q: '', chefs: new Set(), quick: false, video: false, book: false, pick: null, view: 'cards', sort: null };
let RECIPES = [];
let CHEFS = [];
let BY_ID = {};
let cookbook = store.read();

const icon = {
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return 'What are we cooking today?';
  if (h < 16) return 'What sounds good for lunch?';
  return 'What are we cooking tonight?';
}

function ticket(r) {
  const chef = BY_ID[r.chef];
  const time = formatMinutes(r.totalMinutes);
  const saved = cookbook.has(r.url);
  const facts = [
    time && `<span class="fact">${icon.clock}${esc(time)}</span>`,
    r.rating && `<span class="fact rating" title="${r.ratingCount ? esc(r.ratingCount.toLocaleString()) + ' ratings' : 'Rating'}">${icon.star}${r.rating.toFixed(1)}</span>`,
    r.hasVideo === true && `<span class="fact video">${icon.play}Video</span>`,
  ].filter(Boolean);
  const watch = r.hasVideo === true
    ? ''
    : `<a class="btn btn-small" href="${esc(videoSearchUrl(chef.name, r.title))}" target="_blank" rel="noopener">${icon.play}Find a video</a>`;
  return `<li class="ticket">
    <div class="ticket-top">
      <div class="facts"><span class="where">${esc(r.source)}</span>${facts.map(f => '<span class="dot">·</span>' + f).join('')}</div>
      <button class="save" type="button" data-save="${esc(r.url)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from' : 'Save to'} my cookbook: ${esc(r.title)}" title="${saved ? 'Saved' : 'Save to my cookbook'}">${icon.bookmark}</button>
    </div>
    <div class="ticket-body">
      <h3><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a></h3>
      <div class="byline">
        <span class="mono">${esc(initials(chef.name))}</span>
        <span class="byline-text"><span class="byline-name">${esc(chef.name)}</span><br><span class="byline-cred">${esc(chef.credential)}</span></span>
      </div>
    </div>
    <div class="ticket-foot">
      <span class="ticket-actions">${watch}<a class="btn btn-small btn-tomato" href="${esc(r.url)}" target="_blank" rel="noopener">Cook this ${icon.out}</a></span>
    </div>
  </li>`;
}

function currentList() {
  let list = search(RECIPES, BY_ID, { q: state.q, chefs: [...state.chefs], quick: state.quick, video: state.video });
  if (state.book) list = list.filter(r => cookbook.has(r.url));
  return list;
}

function render() {
  const list = currentList();
  const chefsInList = new Set(list.map(r => r.chef)).size;

  let title = 'Recipes from the chefs';
  if (state.book) title = 'My cookbook';
  else if (state.q) title = `${state.q.charAt(0).toUpperCase()}${state.q.slice(1)}, from the chefs`;
  else if (state.chefs.size === 1) title = `${BY_ID[[...state.chefs][0]].name}'s recipes`;
  $('#resultsTitle').textContent = title;
  $('#resultsCount').textContent = list.length
    ? `${list.length} recipe${list.length === 1 ? '' : 's'} from ${chefsInList} chef${chefsInList === 1 ? '' : 's'}`
    : '';

  const compare = state.view === 'compare' && list.length > 1;
  $('#viewSwitch').hidden = list.length < 2;
  document.querySelectorAll('#viewSwitch [data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === (compare ? 'compare' : 'cards')));
  $('#tickets').hidden = compare;
  $('#compare').hidden = !compare;
  $('#tickets').innerHTML = compare ? '' : list.map(ticket).join('');
  $('#compare').innerHTML = compare ? compareTable(list) : '';
  renderEmpty(list);
  renderShelf();
  renderPick();

  $('#quickBtn').setAttribute('aria-pressed', state.quick);
  $('#videoBtn').setAttribute('aria-pressed', state.video);
  $('#bookBtn').setAttribute('aria-pressed', state.book);
  $('#bookCount').textContent = cookbook.size;
  document.querySelectorAll('#chefbar [data-chef]').forEach(b => {
    const id = b.dataset.chef;
    b.setAttribute('aria-pressed', id === '' ? state.chefs.size === 0 : state.chefs.has(id));
  });
  document.querySelectorAll('#cravings [data-q]').forEach(b => b.setAttribute('aria-pressed', norm(b.dataset.q) === norm(state.q)));
  syncUrl();
}

const SORTS = {
  time: (a, b) => (a.totalMinutes ?? Infinity) - (b.totalMinutes ?? Infinity),
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0),
  chef: (a, b) => BY_ID[a.chef].name.localeCompare(BY_ID[b.chef].name),
};

// Every chef's take on the same dish, one row each, so the differences are easy to scan.
function compareTable(list) {
  const rows = state.sort ? [...list].sort(SORTS[state.sort]) : list;
  const head = (key, label) => `<th scope="col"><button type="button" data-sort="${key}" aria-pressed="${state.sort === key}">${label}<span aria-hidden="true">${state.sort === key ? ' ↓' : ''}</span></button></th>`;
  const none = '<span class="nil">–</span>';
  return `<table class="compare">
    <caption class="sr">Recipes side by side. Sort by chef, time or rating.</caption>
    <thead><tr>${head('chef', 'Chef')}<th scope="col">Recipe</th>${head('time', 'Time')}${head('rating', 'Rating')}<th scope="col">Video</th><th scope="col"><span class="sr">Save</span></th></tr></thead>
    <tbody>${rows.map(r => {
      const c = BY_ID[r.chef];
      const saved = cookbook.has(r.url);
      return `<tr>
        <td class="c-chef"><span class="mono">${esc(initials(c.name))}</span><span><b>${esc(c.name)}</b><small>${esc(c.credential)}</small></span></td>
        <td class="c-title"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><small>${esc(r.source)}</small></td>
        <td class="c-num">${r.totalMinutes ? esc(formatMinutes(r.totalMinutes)) : none}</td>
        <td class="c-num">${r.rating ? `<span class="fact rating">${icon.star}${r.rating.toFixed(1)}</span>` : none}</td>
        <td>${r.hasVideo === true
          ? `<span class="fact video">${icon.play}Yes</span>`
          : `<a class="c-find" href="${esc(videoSearchUrl(c.name, r.title))}" target="_blank" rel="noopener">Find one</a>`}</td>
        <td><button class="save" type="button" data-save="${esc(r.url)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from' : 'Save to'} my cookbook: ${esc(r.title)}">${icon.bookmark}</button></td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function renderEmpty(list) {
  const el = $('#tickets');
  if (list.length) return;
  let msg;
  if (state.book && !cookbook.size) msg = '<h3>Your cookbook is empty</h3><p>Tap the bookmark on any recipe to keep it here for next time.</p>';
  else if (state.quick || state.video) msg = '<h3>Nothing matches every filter</h3><p>Try turning off “30 minutes or less” or “Has a video”. Some recipes don’t list their time yet.</p>';
  else msg = `<h3>Not on our shelf yet</h3><p>We haven’t collected ${state.q ? `“${esc(state.q)}”` : 'that'} from these chefs yet. The search below looks for it on their own sites.</p>`;
  el.innerHTML = `<li class="empty">${msg}</li>`;
}

function renderShelf() {
  const dish = state.q || 'dinner';
  const chefs = state.chefs.size ? CHEFS.filter(c => state.chefs.has(c.id)) : CHEFS;
  const videos = chefs.slice(0, 5).map(c =>
    `<a class="btn btn-small" href="${esc(videoSearchUrl(c.name, dish + ' recipe'))}" target="_blank" rel="noopener">${icon.play}${esc(c.name)}</a>`).join('');
  $('#shelf').innerHTML = `
    <h3>Looking for something else?</h3>
    <p>These search the open web and YouTube for “${esc(dish)}”, but only on ${state.chefs.size ? 'the chefs you picked' : 'our chefs’'} own pages. No random blogs.</p>
    <div class="shelf-row">
      <a class="btn btn-small btn-tomato" href="${esc(webSearchUrl(dish, chefs))}" target="_blank" rel="noopener">Search the chefs’ sites ${icon.out}</a>
      ${videos}
    </div>`;
}

function renderPick() {
  const el = $('#pick');
  if (!state.pick) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `<div class="pick-head"><p>Here’s one. You’ve got this.</p>
      <span><button class="linkbtn" type="button" data-repick>Pick another</button> · <button class="linkbtn" type="button" data-unpick>Close</button></span></div>
    <ol class="tickets">${ticket(state.pick)}</ol>`;
}

function pickForMe() {
  const pool = currentList();
  const from = pool.length ? pool : RECIPES;
  // Lean toward quick, well-rated recipes, which suit a tired evening.
  const weight = r => 1 + (r.rating ? r.rating / 2 : 0) + (r.totalMinutes && r.totalMinutes <= 30 ? 2 : 0) + (r.hasVideo ? 1 : 0);
  const choices = from.filter(r => r !== state.pick);
  const total = choices.reduce((s, r) => s + weight(r), 0);
  let n = Math.random() * total;
  state.pick = choices.find(r => (n -= weight(r)) <= 0) || choices[0] || null;
  render();
  $('#pick').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderChefs() {
  const counts = RECIPES.reduce((m, r) => ((m[r.chef] = (m[r.chef] || 0) + 1), m), {});
  $('#chefbar').innerHTML = `<button type="button" class="chefchip all" data-chef="">Any chef</button>` +
    CHEFS.map(c => `<button type="button" class="chefchip" data-chef="${c.id}"><span class="mono">${esc(initials(c.name))}</span>${esc(c.name)}</button>`).join('');
  $('#brigade').innerHTML = CHEFS.map(c => `<li><button type="button" class="cook" data-cook="${c.id}">
      <span class="mono big">${esc(initials(c.name))}</span>
      <span class="cook-name">${esc(c.name)}</span>
      <span class="cook-cred">${esc(c.credential)}</span>
      <span class="cook-about">${esc(c.about)}</span>
      <span class="cook-count">${counts[c.id] ? `${counts[c.id]} recipe${counts[c.id] === 1 ? '' : 's'} on Mise` : 'Search their recipes on the web'}</span>
    </button></li>`).join('');
}

function syncUrl() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.chefs.size) p.set('chef', [...state.chefs].join(','));
  if (state.quick) p.set('quick', '1');
  if (state.video) p.set('video', '1');
  if (state.book) p.set('cookbook', '1');
  if (state.view === 'compare') p.set('view', 'compare');
  const next = p.toString() ? `?${p}` : location.pathname;
  if (next !== location.search) history.replaceState(null, '', next + location.hash);
}

function readUrl() {
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') || '';
  state.chefs = new Set((p.get('chef') || '').split(',').filter(id => BY_ID[id]));
  state.quick = p.get('quick') === '1';
  state.video = p.get('video') === '1';
  state.book = p.get('cookbook') === '1';
  state.view = p.get('view') === 'compare' ? 'compare' : 'cards';
  $('#q').value = state.q;
}

function wire() {
  let t;
  $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value.trim(); state.pick = null; render(); }, 120); });
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    state.q = $('#q').value.trim(); state.pick = null; render();
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#cravings').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    const same = norm(state.q) === norm(b.dataset.q);
    state.q = same ? '' : b.dataset.q; $('#q').value = state.q; state.pick = null; render();
  });
  $('#quickBtn').addEventListener('click', () => { state.quick = !state.quick; render(); });
  $('#videoBtn').addEventListener('click', () => { state.video = !state.video; render(); });
  $('#tiredBtn').addEventListener('click', pickForMe);
  $('#viewSwitch').addEventListener('click', e => {
    const b = e.target.closest('[data-view]'); if (!b) return;
    state.view = b.dataset.view; render();
  });
  $('#compare').addEventListener('click', e => {
    const b = e.target.closest('[data-sort]'); if (!b) return;
    state.sort = state.sort === b.dataset.sort ? null : b.dataset.sort; render();
  });
  $('#bookBtn').addEventListener('click', () => { state.book = !state.book; state.pick = null; render(); $('#results').scrollIntoView({ behavior: 'smooth' }); });
  $('#chefbar').addEventListener('click', e => {
    const b = e.target.closest('[data-chef]'); if (!b) return;
    const id = b.dataset.chef;
    if (!id) state.chefs.clear();
    else state.chefs.has(id) ? state.chefs.delete(id) : state.chefs.add(id);
    render();
  });
  $('#brigade').addEventListener('click', e => {
    const b = e.target.closest('[data-cook]'); if (!b) return;
    state.chefs = new Set([b.dataset.cook]); state.q = ''; $('#q').value = ''; state.book = false; render();
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-save]');
    if (s) {
      const url = s.dataset.save;
      cookbook.has(url) ? cookbook.delete(url) : cookbook.add(url);
      store.write(cookbook);
      render();
      document.querySelectorAll(`[data-save="${CSS.escape(url)}"]`).forEach(b => b.classList.add('pop'));
    }
    if (e.target.closest('[data-repick]')) pickForMe();
    if (e.target.closest('[data-unpick]')) { state.pick = null; render(); }
  });
  window.addEventListener('storage', e => { if (e.key === BOOK_KEY) { cookbook = store.read(); render(); } });
}

async function start() {
  $('#greeting').textContent = greeting();
  $('#cravings').innerHTML = CRAVINGS.map(c => `<button type="button" class="chip" data-q="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('');
  try {
    const [chefs, recipes] = await Promise.all([
      fetch('data/chefs.json').then(r => r.json()),
      fetch('data/recipes.json').then(r => r.json()),
    ]);
    CHEFS = chefs; RECIPES = recipes; BY_ID = Object.fromEntries(chefs.map(c => [c.id, c]));
  } catch {
    $('#tickets').innerHTML = '<li class="empty"><h3>The recipes didn’t load</h3><p>Check your connection and refresh the page.</p></li>';
    return;
  }
  renderChefs();
  readUrl();
  wire();
  render();
}

start();

// Lets Mise be added to a phone's home screen and keeps the cookbook usable offline.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
