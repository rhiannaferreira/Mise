// How hard a recipe is, on a three-step scale shared by the app and the recipe collector.
// The chef's own label wins when their page states one (Food Network's "Level", Jamie Oliver's
// "Not too tricky"). Otherwise we score the recipe's size and technique: how many ingredients and
// steps it has, how long it takes, and whether the method calls for skills like tempering or
// laminating. The ingredient list and method are read to count them and are never stored.

export const LEVELS = [
  { id: 'easy', label: 'Easy', hint: 'Any night of the week' },
  { id: 'medium', label: 'Medium', hint: 'A little care' },
  { id: 'hard', label: 'Challenge', hint: 'A project worth the time' },
];

// Techniques that take practice. Each one found in the method adds to the score.
const TECHNIQUES = [
  /\btemper(ed|ing)?\b/, /\blaminat/, /\bsous[- ]vide\b/, /\bconfit\b/, /\bsoft ball\b|\bhard crack\b|\bcandy thermometer\b/,
  /\bproof(ed|ing)?\b|\blet (the )?dough rise\b/, /\bfold in the (egg )?whites\b|\bstiff peaks\b/, /\bdeep[- ]fry|\b(350|360|375)\s?°?\s?f? oil\b/,
  /\bemulsif/, /\bclarif(y|ied)\b/, /\bbutterfly\b|\bdebone\b|\bfillet the\b|\btruss\b/, /\broll (out )?the (pasta )?dough\b|\bpasta machine\b/,
  /\bcaramel\b/, /\bbain[- ]marie\b|\bwater bath\b/, /\bpuff pastry\b|\bpâte|\bpate a choux|\bchoux\b/, /\bcure\b|\bbrine\b/,
  /\bsoufflé|\bsouffle\b/, /\bcustard\b/, /\bsmok(e|ing) (it|the)\b/, /\bovernight\b/,
];

// Dishes known to be a project, and ones that are quick wins, for pages that give us nothing else.
const HARD_DISHES = /\b(wellington|soufflé|souffle|croissant|consomm|cassoulet|baklava|macarons?\b|mille|opera cake|puff pastry|terrine|pâté|pate en croute|ballotine|galantine|laminated|choux|croquembouche|beignet|brioche|sourdough|ramen|mole\b|tamales|bouillabaisse|paella|ravioli|tortellini|cappelletti|agnolotti|handmade pasta|fresh pasta|pasta dough|gnocchi|risotto|duck confit|confit|porchetta|crown roast|beef bourguignon|bourguignon|coq au vin|dumplings|bao|pastry|layer cake|tarts?\b|roulade|doughnut|donut|cheesecake|caramel|biryani|paratha|croqueta|sushi|gumbo|pastiera)/;
const EASY_DISHES = /\b(salad|toast|sandwich|dip\b|guacamole|bruschetta|crostini|smoothie|scrambled|omelet|vinaigrette|slaw|quesadilla|grilled cheese|frittata|aglio|cacio e pepe|pesto|roasted vegetables|sheet.pan|one.pan|5.ingredient|quick|easy|simple|weeknight)/;

const STATED = [
  [/^(easy|beginner|super easy|simple|not too tricky)$/i, 'easy'],
  [/^(intermediate|medium|moderate|showing off a little)$/i, 'medium'],
  [/^(advanced|hard|difficult|expert|showing off|challenging)$/i, 'hard'],
];

export function levelFromLabel(label) {
  if (!label) return null;
  const s = String(label).trim();
  for (const [re, id] of STATED) if (re.test(s)) return id;
  return null;
}

// The level a chef's page states, if any. Covers Food Network, Jamie Oliver and plain JSON fields.
export function statedLevel(html = '') {
  const pats = [
    /Level:\s*<\/span>\s*<span[^>]*>\s*([A-Za-z ]+?)\s*</i,
    /"difficulty"\s*:\s*"([^"]{3,24})"/i,
    /difficulty[^>]*>\s*(?:<[^>]+>\s*)*(Super easy|Not too tricky|Showing off|Easy|Medium|Hard)\s*</i,
  ];
  for (const re of pats) {
    const m = html.match(re);
    const id = m && levelFromLabel(m[1]);
    if (id) return id;
  }
  return null;
}

// Scores a recipe from its counts. Returns 'easy', 'medium' or 'hard'.
export function scoreLevel({ ingredients = 0, steps = 0, minutes = null, method = '', title = '' } = {}) {
  let pts = 0;
  if (ingredients >= 15) pts += 2; else if (ingredients >= 10) pts += 1; else if (ingredients && ingredients <= 5) pts -= 1;
  if (steps >= 10) pts += 2; else if (steps >= 6) pts += 1; else if (steps && steps <= 2) pts -= 1;
  // Very long times are usually waiting (marinating, steeping), so only moderate weight.
  if (minutes != null && minutes <= 1440) { if (minutes >= 150) pts += 1; if (minutes <= 20) pts -= 1; }
  const text = method.toLowerCase();
  pts += Math.min(TECHNIQUES.filter(re => re.test(text)).length, 3);
  const t = ' ' + title.toLowerCase() + ' ';
  if (HARD_DISHES.test(t)) pts += 2;
  if (EASY_DISHES.test(t)) pts -= 1;
  return pts >= 4 ? 'hard' : pts >= 2 ? 'medium' : 'easy';
}

// For recipes we know only by title and time (hand-picked pages we couldn't read).
export function guessLevel(title = '', minutes = null) {
  const t = ' ' + title.toLowerCase() + ' ';
  let pts = 1;
  if (HARD_DISHES.test(t)) pts += 2;
  if (EASY_DISHES.test(t)) pts -= 1;
  if (minutes != null) { if (minutes >= 150) pts += 1; if (minutes <= 30) pts -= 1; }
  return pts >= 3 ? 'hard' : pts >= 1 ? 'medium' : 'easy';
}
