// Courses and cuisines shared by the app and the recipe collector.

export const COURSES = [
  { id: 'appetizers', label: 'Appetizers', hint: 'Small plates and dips' },
  { id: 'pasta', label: 'Pasta & risotto', hint: 'Bowls worth twirling' },
  { id: 'mains', label: 'Mains', hint: 'Chicken, steak, fish' },
  { id: 'soups', label: 'Soups & stews', hint: 'One pot, big comfort' },
  { id: 'sides', label: 'Salads & sides', hint: 'Greens, potatoes, bread' },
  { id: 'breakfast', label: 'Breakfast & eggs', hint: 'Omelettes and more' },
  { id: 'desserts', label: 'Desserts', hint: 'Cakes, tarts, puddings' },
];

export const CUISINES = [
  { id: 'italian', label: 'Italian' },
  { id: 'american', label: 'American' },
  { id: 'french', label: 'French' },
  { id: 'mexican', label: 'Mexican & Latin' },
  { id: 'asian', label: 'Asian' },
  { id: 'british', label: 'British' },
  { id: 'mediterranean', label: 'Mediterranean' },
];

const COURSE_WORDS = [
  ['appetizers', /\b(appetizer|starter|hors d|bruschetta|crostini|dip\b|guacamole|antipasto|arancini|crab cake|deviled|canap|tapas)/],
  ['desserts', /\b(dessert|cake|tart|pie crust|cookie|brownie|pudding|budino|tiramisu|panna cotta|ice cream|sorbet|crumble|cobbler|cheesecake|custard|mousse)/],
  ['breakfast', /\b(breakfast|brunch|omelet|omelette|frittata|pancake|waffle|scrambled|french toast)/],
  ['soups', /\b(soup|stew|chili|chowder|bisque|gazpacho|minestrone|pepperpot|broth)/],
  ['pasta', /\b(pasta|spaghetti|penne|rigatoni|linguine|fettuc|tagliatelle|pappardelle|orecchiette|bucatini|capellini|lasagna|ravioli|tortellini|cappelletti|orzo|macaroni|gnocchi|risotto|carbonara|bolognese|shells)/],
  ['mains', /^ (grilled |roast |roasted |seared |pan-seared )?(salmon|chicken|steak|beef|pork|lamb|fish|shrimp|cod|tuna)\b/],
  ['sides', /\b(side dish|side|salad|slaw|potatoes|roasted vegetables|greens|corn bread|cornbread|gratin|tian)/],
];

const CUISINE_WORDS = [
  ['american', /\b(mac and cheese|macaroni and cheese)/],
  ['italian', /\b(italian|tuscan|sicilian|roman|parmesan|piccata|bruschetta|risotto|tiramisu|panna cotta|arancini|antipasto)/],
  ['french', /\b(french|provencal|provençal|bistro|gratin|tian|coq au vin|bourguignon|omelette|poulet)/],
  ['mexican', /\b(mexican|latin|caribbean|tex-mex|southwest|taco|enchilada|burrito|quesadilla|guacamole|salsa|mole|tamale)/],
  ['asian', /\b(asian|thai|chinese|japanese|korean|vietnamese|indian|curry|teriyaki|stir.fry|pad thai|pad kee|ramen|udon|soba|rice noodle|lo mein|gyoza|dim sum|fried rice)/],
  ['british', /\b(british|english|wellington|fish and chips|fish pie|toffee pudding|shepherd)/],
  ['mediterranean', /\b(mediterranean|greek|spanish|moroccan|lebanese|middle eastern|paella|gazpacho|souvlaki|tapas|tagine|hummus)/],
  ['american', /\b(american|southern|burger|bbq|barbecue|cajun|creole|grits|mac and cheese|macaroni and cheese)/],
];

const hay = (title, keywords) => (' ' + [title, ...(keywords || [])].join(' ') + ' ').toLowerCase();

export function guessCourse(title, keywords = []) {
  const h = hay(title, keywords);
  for (const [id, re] of COURSE_WORDS) if (re.test(h)) return id;
  return 'mains';
}

export function guessCuisine(title, keywords = [], fallback = 'american', course = guessCourse(title, keywords)) {
  const h = hay(title, keywords);
  for (const [id, re] of CUISINE_WORDS) if (re.test(h)) return id;
  if (course === 'pasta') return 'italian'; // pasta with no other clue is almost always Italian
  return fallback;
}
