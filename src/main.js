import { search, formatMinutes, webSearchUrl, videoSearchUrl, norm } from './search.js';
import { COURSES, CUISINES } from './categories.js';
import { LEVELS } from './difficulty.js';

const CRAVINGS = ['Carbonara', 'Roast chicken', 'Chicken soup', 'Tacos', 'Salmon', 'Tiramisu'];
const COURSE_BY_ID = Object.fromEntries(COURSES.map(c => [c.id, c]));
const CUISINE_BY_ID = Object.fromEntries(CUISINES.map(c => [c.id, c]));
const LEVEL_BY_ID = Object.fromEntries(LEVELS.map(l => [l.id, l]));
const LEVEL_RANK = { easy: 1, medium: 2, hard: 3 };
const levelBadge = id => LEVEL_BY_ID[id]
  ? `<span class="fact level" title="${esc(LEVEL_BY_ID[id].hint)}"><span class="pips" data-l="${id}" aria-hidden="true"><i></i><i></i><i></i></span>${esc(LEVEL_BY_ID[id].label)}</span>`
  : '';

// Simple line drawings for each course, in the same stroke style as the other icons.
const COURSE_ICON = {
  appetizers: '<path d="M4 11a8 5 0 0 1 16 0v8H4z"/><circle cx="9" cy="14" r="1.3"/><circle cx="14.5" cy="15.5" r="1.3"/><circle cx="13" cy="11.5" r="1"/>',
  pasta: '<path d="M3 12h18a9 7 0 0 1-18 0z"/><path d="M8 12c1-2-1-3 0-5s3-1 4-3M13 12c1-2-1-3 0-5s3-1 4-3"/>',
  mains: '<path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 9V7M10 7h4"/>',
  soups: '<path d="M3 11h18a9 7 0 0 1-18 0z"/><path d="M9 7.5c-1-1.2 1-2 0-3.5M13 7.5c-1-1.2 1-2 0-3.5M17 7.5c-1-1.2 1-2 0-3.5"/>',
  sides: '<path d="M5 19c0-9 6-14 15-14 0 8-5 14-15 14z"/><path d="M5 19 14 10"/>',
  breakfast: '<path d="M12 4c5 0 8 3 7.5 7-.4 2.6-2 3.4-1.3 6.2.6 2.4-4 3.6-7.2 2.7C7.8 19 4 18.6 4.2 14.5 4.4 10.4 6.8 4 12 4z"/><circle cx="11.5" cy="12" r="3"/>',
  desserts: '<path d="M3 20h18v-8L3 16z"/><path d="M3 16v4M21 15.5H3"/><path d="M16 8.5c0-1.5 1.5-2 1-3.5"/>',
};
const BOOK_KEY = 'mise.cookbook';

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = name => name.replace(/^J\. /, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('');

const store = {
  read() { try { return new Set(JSON.parse(localStorage.getItem(BOOK_KEY)) || []); } catch { return new Set(); } },
  write(set) { try { localStorage.setItem(BOOK_KEY, JSON.stringify([...set])); } catch { /* private mode */ } },
};

const state = { q: '', chefs: new Set(), quick: false, video: false, book: false, pick: null, view: 'cards', sort: null, course: '', cuisine: '', level: '', menu: null };
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
  const level = levelBadge(r.level);
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
      ${level}<span class="ticket-actions">${watch}<a class="btn btn-small btn-tomato" href="${esc(r.url)}" target="_blank" rel="noopener">Cook this ${icon.out}</a></span>
    </div>
  </li>`;
}

function currentList() {
  let list = search(RECIPES, BY_ID, { q: state.q, chefs: [...state.chefs], quick: state.quick, video: state.video, course: state.course, cuisine: state.cuisine, level: state.level });
  if (state.book) list = list.filter(r => cookbook.has(r.url));
  return list;
}

function render() {
  const list = currentList();
  const chefsInList = new Set(list.map(r => r.chef)).size;

  let title = 'Recipes from the chefs';
  if (state.book) title = 'My cookbook';
  else if (state.q) title = `${state.q.charAt(0).toUpperCase()}${state.q.slice(1)}, from the chefs`;
  else if (state.course || state.cuisine) title = [CUISINE_BY_ID[state.cuisine]?.label, state.course ? COURSE_BY_ID[state.course].label.toLowerCase() : 'recipes'].filter(Boolean).join(' ').replace(/^./, c => c.toUpperCase());
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
  $('#tickets').removeAttribute('aria-busy');
  renderEmpty(list);
  renderProfile();
  renderShelf();
  renderPick();
  renderMenu();

  $('#quickBtn').setAttribute('aria-pressed', state.quick);
  $('#videoBtn').setAttribute('aria-pressed', state.video);
  document.querySelectorAll('#levelPick [data-level]').forEach(b => b.setAttribute('aria-pressed', b.dataset.level === state.level));
  $('#bookBtn').setAttribute('aria-pressed', state.book);
  $('#bookCount').textContent = cookbook.size;
  document.querySelectorAll('#chefbar [data-chef]').forEach(b => {
    const id = b.dataset.chef;
    b.setAttribute('aria-pressed', id === '' ? state.chefs.size === 0 : state.chefs.has(id));
  });
  // Keep a picked chef visible in the sideways-scrolling chef bar.
  revealPickedChef();
  document.querySelectorAll('#courses [data-course]').forEach(b => b.setAttribute('aria-pressed', b.dataset.course === state.course));
  document.querySelectorAll('#cuisines [data-cuisine]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cuisine === state.cuisine));
  renderActive();
  document.querySelectorAll('#cravings [data-q]').forEach(b => b.setAttribute('aria-pressed', norm(b.dataset.q) === norm(state.q)));
  syncUrl();
}

const SORTS = {
  time: (a, b) => (a.totalMinutes ?? Infinity) - (b.totalMinutes ?? Infinity),
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0),
  chef: (a, b) => BY_ID[a.chef].name.localeCompare(BY_ID[b.chef].name),
  level: (a, b) => (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9),
};

// Every chef's take on the same dish, one row each, so the differences are easy to scan.
function compareTable(list) {
  const rows = state.sort ? [...list].sort(SORTS[state.sort]) : list;
  const head = (key, label) => `<th scope="col"><button type="button" data-sort="${key}" aria-pressed="${state.sort === key}">${label}<span aria-hidden="true">${state.sort === key ? ' ↓' : ''}</span></button></th>`;
  const none = '<span class="nil">–</span>';
  return `<table class="compare">
    <caption class="sr">Recipes side by side. Sort by chef, time, rating or level.</caption>
    <thead><tr>${head('chef', 'Chef')}<th scope="col">Recipe</th>${head('time', 'Time')}${head('rating', 'Rating')}${head('level', 'Level')}<th scope="col">Video</th><th scope="col"><span class="sr">Save</span></th></tr></thead>
    <tbody>${rows.map(r => {
      const c = BY_ID[r.chef];
      const saved = cookbook.has(r.url);
      return `<tr>
        <td class="c-chef"><span class="mono">${esc(initials(c.name))}</span><span><b>${esc(c.name)}</b><small>${esc(c.credential)}</small></span></td>
        <td class="c-title"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><small>${esc(r.source)}</small></td>
        <td class="c-num">${r.totalMinutes ? esc(formatMinutes(r.totalMinutes)) : none}</td>
        <td class="c-num">${r.rating ? `<span class="fact rating">${icon.star}${r.rating.toFixed(1)}</span>` : none}</td>
        <td>${levelBadge(r.level) || none}</td>
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
  else if (state.course || state.cuisine) msg = `<h3>Nothing here yet</h3><p>We don\u2019t have ${esc([CUISINE_BY_ID[state.cuisine]?.label, COURSE_BY_ID[state.course]?.label.toLowerCase()].filter(Boolean).join(' '))} from these chefs yet. Try another course or cuisine, or the search below.</p>`;
  else if (state.quick || state.video || state.level) msg = '<h3>Nothing matches every filter</h3><p>Try a different level, or turn off “30 minutes or less” or “Has a video”. Some recipes don’t list their time yet.</p>';
  else msg = `<h3>Not on our shelf yet</h3><p>We haven’t collected ${state.q ? `“${esc(state.q)}”` : 'that'} from these chefs yet. The search below looks for it on their own sites.</p>`;
  el.innerHTML = `<li class="empty">${msg}</li>`;
}

function revealPickedChef() {
  const bar = $('#chefbar');
  const center = () => {
    const chip = bar.querySelector('[data-chef]:not([data-chef=""])[aria-pressed="true"]');
    if (!chip) return;
    if (chip.offsetLeft >= bar.scrollLeft && chip.offsetLeft + chip.offsetWidth <= bar.scrollLeft + bar.clientWidth) return;
    bar.scrollLeft = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
  };
  center();
  document.fonts?.ready.then(center); // chip widths change once the web fonts arrive
}

// What's narrowing the list right now, each with a one-tap way to undo it.
function renderActive() {
  const chips = [];
  if (state.course) chips.push(['course', COURSE_BY_ID[state.course].label]);
  if (state.cuisine) chips.push(['cuisine', CUISINE_BY_ID[state.cuisine].label]);
  if (state.quick) chips.push(['quick', '30 minutes or less']);
  if (state.video) chips.push(['video', 'Has a video']);
  if (state.level) chips.push(['level', LEVEL_BY_ID[state.level].label]);
  $('#active').innerHTML = chips.map(([k, label]) =>
    `<button type="button" class="active-chip" data-clear="${k}" aria-label="Remove filter: ${esc(label)}">${esc(label)}<span aria-hidden="true">\u00d7</span></button>`).join('') +
    (chips.length > 1 ? '<button type="button" class="linkbtn" data-clear="all">Clear all</button>' : '');
}

function renderBrowse() {
  const count = key => RECIPES.reduce((m, r) => ((m[r[key]] = (m[r[key]] || 0) + 1), m), {});
  const courses = count('course'), cuisines = count('cuisine');
  $('#courses').innerHTML = COURSES.map(c => `<li><button type="button" class="course" data-course="${c.id}" aria-pressed="false">
      <svg viewBox="0 0 24 24" aria-hidden="true">${COURSE_ICON[c.id]}</svg>
      <span class="course-name">${esc(c.label)}</span>
      <span class="course-hint">${esc(c.hint)}</span>
      <span class="course-count">${courses[c.id] || 0}</span>
    </button></li>`).join('');
  $('#cuisines').innerHTML = CUISINES.map(c =>
    `<button type="button" class="chip" data-cuisine="${c.id}" aria-pressed="false">${esc(c.label)} <span class="chip-count">${cuisines[c.id] || 0}</span></button>`).join('');
}

// A chef's own page: who they are, why they're here, and where to find more of their cooking.
function renderProfile() {
  const el = $('#profile');
  const only = state.chefs.size === 1 && !state.book ? BY_ID[[...state.chefs][0]] : null;
  if (!only) { el.hidden = true; el.innerHTML = ''; return; }
  const count = RECIPES.filter(r => r.chef === only.id).length;
  const sites = only.sources.map(s => `<a class="btn btn-small" href="https://${esc(s.host)}${esc(s.pathPrefix)}" target="_blank" rel="noopener">All their recipes on ${esc(s.label)} ${icon.out}</a>`).join('');
  el.hidden = false;
  el.innerHTML = `
    <span class="mono huge">${esc(initials(only.name))}</span>
    <div class="profile-text">
      <span class="cook-cred">${esc(only.credential)}</span>
      <h3>${esc(only.name)}</h3>
      <p>${esc(only.about)}</p>
      <p class="profile-count">${count} recipe${count === 1 ? '' : 's'} on Mise so far.</p>
      <div class="shelf-row">${sites}<a class="btn btn-small" href="${esc(videoSearchUrl(only.name, 'cooking'))}" target="_blank" rel="noopener">${icon.play}Watch them cook</a>
        <button class="linkbtn" type="button" data-allchefs>Back to every chef</button></div>
    </div>`;
}

function renderShelf() {
  const dish = state.q || [CUISINE_BY_ID[state.cuisine]?.label, COURSE_BY_ID[state.course]?.label.toLowerCase()].filter(Boolean).join(' ') || 'dinner';
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

// A three-course dinner from one kitchen: a starter, a main and a dessert.
const MENU_COURSES = [
  { key: 'starter', label: 'To start', from: ['appetizers', 'soups', 'sides'] },
  { key: 'main', label: 'The main', from: ['mains', 'pasta'] },
  { key: 'dessert', label: 'To finish', from: ['desserts'] },
];
// Short, stable ids so a planned menu fits in a link you can text to guests.
const shortId = url => [...url].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7).toString(36);
const pickOne = list => list[Math.floor(Math.random() * list.length)] || null;

function menuDish(course, cuisine, avoid) {
  const fits = r => course.from.includes(r.course) && r !== avoid;
  const tiers = [
    r => fits(r) && r.cuisine === cuisine && (!state.level || r.level === state.level) && r.course === course.from[0],
    r => fits(r) && r.cuisine === cuisine && (!state.level || r.level === state.level),
    r => fits(r) && r.cuisine === cuisine,
    r => fits(r) && (!state.level || r.level === state.level),
  ];
  // Prefer a different chef for each course, so one dinner shows off several cooks.
  const used = new Set(MENU_COURSES.map(c => state.menu?.[c.key]?.chef).filter(id => id && id !== avoid?.chef));
  for (const t of tiers) {
    const pool = RECIPES.filter(t);
    const fresh = pool.filter(r => !used.has(r.chef));
    if (pool.length) return pickOne(fresh.length ? fresh : pool);
  }
  return null;
}

function planMenu(cuisine) {
  const kitchens = CUISINES.map(c => c.id).filter(id => RECIPES.some(r => r.cuisine === id && r.course === 'mains'));
  const pickCuisine = cuisine || state.cuisine || pickOne(kitchens.filter(id => id !== state.menu?.cuisine));
  state.menu = { cuisine: pickCuisine };
  for (const c of MENU_COURSES) state.menu[c.key] = menuDish(c, pickCuisine);
  // The used-chef check runs as each course is filled, so fill a second time to balance the first pick too.
  state.menu.starter = menuDish(MENU_COURSES[0], pickCuisine, state.menu.starter) || state.menu.starter;
  state.pick = null;
  render();
  $('#menu').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderMenu() {
  const el = $('#menu');
  const m = state.menu;
  if (!m) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const kitchen = CUISINE_BY_ID[m.cuisine]?.label || '';
  const rows = MENU_COURSES.map(c => {
    const r = m[c.key];
    if (!r) return '';
    const chef = BY_ID[r.chef];
    const elsewhere = r.cuisine !== m.cuisine ? ` <span class="menu-note">from the ${esc(CUISINE_BY_ID[r.cuisine]?.label)} kitchen</span>` : '';
    const time = formatMinutes(r.totalMinutes);
    return `<li class="menu-course">
      <span class="menu-label">${c.label}</span>
      <a class="menu-dish" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
      <span class="menu-meta">${esc(chef.name)}${time ? ' · ' + esc(time) : ''}${elsewhere}</span>
      <span class="menu-row">${levelBadge(r.level)}<button type="button" class="linkbtn" data-swap="${c.key}" aria-label="Swap ${c.label.toLowerCase()}: ${esc(r.title)}">Swap</button></span>
    </li>`;
  }).join('<li class="menu-rule" aria-hidden="true">✦</li>');
  el.innerHTML = `<div class="menu-paper">
      <p class="menu-kicker">Tonight’s menu</p>
      <h3 class="menu-title">${esc(kitchen)}</h3>
      <ol class="menu-list">${rows}</ol>
      <div class="menu-actions">
        <button type="button" class="btn btn-small btn-tomato" data-share>Share this menu</button>
        <button type="button" class="btn btn-small" data-replan>Another kitchen</button>
        <button type="button" class="btn btn-small" data-reshuffle>Shuffle these dishes</button>
        <button type="button" class="linkbtn" data-unmenu>Close</button>
      </div>
      <p class="menu-shared" role="status" aria-live="polite"></p>
      <p class="menu-tip">Make the dessert first. It’s one less thing when guests arrive.</p>
    </div>`;
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
  if (state.course) p.set('course', state.course);
  if (state.cuisine) p.set('cuisine', state.cuisine);
  if (state.level) p.set('level', state.level);
  if (state.menu) p.set('menu', [state.menu.cuisine, ...MENU_COURSES.map(c => state.menu[c.key] ? shortId(state.menu[c.key].url) : '-')].join('.'));
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
  state.course = COURSE_BY_ID[p.get('course')] ? p.get('course') : '';
  state.cuisine = CUISINE_BY_ID[p.get('cuisine')] ? p.get('cuisine') : '';
  state.level = LEVEL_BY_ID[p.get('level')] ? p.get('level') : '';
  const menu = (p.get('menu') || '').split('.');
  if (CUISINE_BY_ID[menu[0]]) {
    const byShort = new Map(RECIPES.map(r => [shortId(r.url), r]));
    state.menu = { cuisine: menu[0] };
    MENU_COURSES.forEach((c, i) => { state.menu[c.key] = byShort.get(menu[i + 1]) || menuDish(c, menu[0]); });
  }
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
  const toResults = () => $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#courses').addEventListener('click', e => {
    const b = e.target.closest('[data-course]'); if (!b) return;
    state.course = state.course === b.dataset.course ? '' : b.dataset.course;
    state.q = ''; $('#q').value = ''; state.pick = null; state.book = false; render();
    if (state.course) toResults();
  });
  $('#cuisines').addEventListener('click', e => {
    const b = e.target.closest('[data-cuisine]'); if (!b) return;
    state.cuisine = state.cuisine === b.dataset.cuisine ? '' : b.dataset.cuisine;
    state.q = ''; $('#q').value = ''; state.pick = null; state.book = false; render();
    if (state.cuisine) toResults();
  });
  $('#active').addEventListener('click', e => {
    const b = e.target.closest('[data-clear]'); if (!b) return;
    const k = b.dataset.clear;
    if (k === 'course' || k === 'all') state.course = '';
    if (k === 'cuisine' || k === 'all') state.cuisine = '';
    if (k === 'quick' || k === 'all') state.quick = false;
    if (k === 'video' || k === 'all') state.video = false;
    if (k === 'level' || k === 'all') state.level = '';
    render();
  });
  $('#quickBtn').addEventListener('click', () => { state.quick = !state.quick; render(); });
  $('#videoBtn').addEventListener('click', () => { state.video = !state.video; render(); });
  $('#levelPick').addEventListener('click', e => {
    const b = e.target.closest('[data-level]'); if (!b) return;
    state.level = state.level === b.dataset.level ? '' : b.dataset.level; state.pick = null; render();
  });
  $('#tiredBtn').addEventListener('click', () => { state.menu = null; pickForMe(); });
  $('#menuBtn').addEventListener('click', () => planMenu());
  $('#menu').addEventListener('click', e => {
    const swap = e.target.closest('[data-swap]');
    if (swap) {
      const c = MENU_COURSES.find(x => x.key === swap.dataset.swap);
      state.menu[c.key] = menuDish(c, state.menu.cuisine, state.menu[c.key]) || state.menu[c.key];
      renderMenu();
      syncUrl();
      $(`#menu [data-swap="${c.key}"]`)?.focus();
      return;
    }
    if (e.target.closest('[data-replan]')) { const keep = state.cuisine; state.cuisine = ''; planMenu(); state.cuisine = keep; render(); return; }
    if (e.target.closest('[data-reshuffle]')) { planMenu(state.menu.cuisine); return; }
    if (e.target.closest('[data-share]')) {
      const link = location.href;
      const done = msg => { $('#menu .menu-shared').textContent = msg; };
      const title = `Dinner: ${MENU_COURSES.map(c => state.menu[c.key]?.title).filter(Boolean).join(', ')}`;
      if (navigator.share) navigator.share({ title, url: link }).catch(() => {});
      else navigator.clipboard?.writeText(link).then(() => done('Link copied. Send it to whoever\u2019s coming.'), () => done(link));
      return;
    }
    if (e.target.closest('[data-unmenu]')) { state.menu = null; render(); $('#menuBtn').focus(); }
  });
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
    if (e.target.closest('[data-allchefs]')) { state.chefs.clear(); render(); }
  });
  // Press / anywhere to jump to the search box, Escape to clear it.
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); $('#q').focus(); }
    if (e.key === 'Escape' && document.activeElement === $('#q') && $('#q').value) {
      $('#q').value = ''; state.q = ''; render();
    }
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
  renderBrowse();
  readUrl();
  wire();
  render();
}

start();

// Lets Mise be added to a phone's home screen and keeps the cookbook usable offline.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
