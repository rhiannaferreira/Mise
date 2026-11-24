// Turns a title and site keywords into simple dish tags that search can use.
const FAMILIES = {
  pasta: ['pasta', 'spaghetti', 'penne', 'rigatoni', 'linguine', 'fettuccine', 'fettucine', 'fettuccini', 'tagliatelle', 'pappardelle', 'orecchiette', 'bucatini', 'capellini', 'mafaldine', 'lasagna', 'lasagne', 'ravioli', 'tortellini', 'cappelletti', 'orzo', 'macaroni', 'mac', 'ziti', 'gnocchi', 'noodle', 'noodles', 'carbonara', 'bolognese', 'cacio'],
  chicken: ['chicken', 'poultry'],
  beef: ['beef', 'steak', 'wellington', 'brisket', 'short rib', 'meatball', 'meatballs'],
  seafood: ['shrimp', 'scampi', 'salmon', 'fish', 'clams', 'mussels', 'scallops', 'crab', 'lobster', 'anchovy', 'tuna', 'cod'],
  soup: ['soup', 'stew', 'chili', 'fagioli'],
  rice: ['risotto', 'rice', 'paella'],
  dessert: ['cake', 'cookie', 'cookies', 'pie', 'tart', 'brownie', 'brownies', 'pudding', 'ice cream'],
};

export function deriveTags(title = '', keywords = []) {
  const hay = ' ' + [title, ...keywords].join(' ').toLowerCase() + ' ';
  const tags = new Set();
  for (const [family, words] of Object.entries(FAMILIES)) {
    if (words.some(w => hay.includes(' ' + w + ' ') || hay.includes(' ' + w + ',') || hay.includes(' ' + w + 's '))) tags.add(family);
  }
  for (const k of keywords) if (k.length <= 24) tags.add(k);
  return [...tags];
}
