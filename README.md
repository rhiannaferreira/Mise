# Mise

**Search a dish. Get recipes only from chefs worth trusting.**

Search "carbonara" on Google and you get a thousand blogs, each with a life story before the ingredients. Mise only shows recipes from chefs with real credentials: Food Network hosts, Top Chef, and restaurant chefs with Michelin stars or James Beard awards. Every result names the chef, shows the cook time, rating and whether there's a video, and opens the recipe on the chef's own page.

Mise never copies recipes. The chef keeps the visit and the credit.

## What it does

- **Search by dish.** "Carbonara", "lemon pasta", "prawns". Dish families and everyday words are understood, so "spaghetti" finds pasta and "prawns" finds shrimp.
- **Browse the menu.** Seven courses (appetizers, pasta and risotto, mains, soups and stews, salads and sides, breakfast, desserts) and seven cuisines, with counts, so you can wander when you don't have a dish in mind.
- **Easy to Challenge.** Every recipe carries a level: Easy, Medium or Challenge. It comes from the chef's own page when they state one, and otherwise from the recipe's size and technique (how many ingredients and steps, how long it takes, and whether it asks for things like tempering or laminating). Filter by level when you want a weeknight win or a weekend project.
- **Plan a three-course dinner.** One tap sets a starter, a main and a dessert from one kitchen, usually from three different chefs, on a card that looks like a restaurant's printed menu. Swap any course, or try another cuisine.
- **Search the way you talk.** "Easy pasta", "challenging dessert", "spanish appetizers" and "indian" all work. Words about level, course and cuisine narrow the results.
- **Credit up front.** Each recipe card names the chef and why they count ("3 Michelin stars", "Top Chef head judge").
- **Built for tired evenings.** One tap for "30 minutes or less", one for "Has a video", and a "Too tired to choose? Pick for me" button that suggests something quick and well rated.
- **My cookbook.** Bookmark recipes to come back to. Saved on your device, no account needed.
- **Lives on your phone.** Add Mise to your home screen like an app. Your cookbook and the recipe list still open with no signal.
- **Never a dead end.** If a dish isn't collected yet, Mise searches the web and YouTube for it, limited to the chefs' own pages.

## How the recipes get in

```
public/data/chefs.json      the chefs, why they count, and which pages are theirs
        │
        ▼
scripts/crawl.mjs           weekly (GitHub Actions)
   1. reads each site's robots.txt and follows it, with a 2.5 s pause between pages
   2. walks the site's sitemap for pages under the chef's own path
   3. reads the schema.org Recipe data the page publishes for search engines
   4. keeps only: title, total time, rating, video yes/no, level, link
      (ingredients and steps are counted for the level, then dropped)
   5. files it under a course and cuisine (src/categories.js)
        │
        ▼
public/data/recipes.json    what the app searches
```

Ingredients, steps and photos are never stored. A test checks this.

### Who gets in

A chef needs a TV cooking credential (Food Network, Top Chef, Iron Chef, PBS) or a serious restaurant credential (Michelin stars, James Beard award). To add one, give them an entry in `public/data/chefs.json`. If their recipes live on their own site or under their own path, add it to `sources` and the collector picks them up on its next run.

## Run it

Needs Node 20 or newer.

```bash
npm install
npm run dev        # open the local address it prints
npm test           # search, categories, parsing and robots.txt tests
npm run build      # static site in dist/
npm run crawl -- --only ina --max-new 5   # collect a few recipes by hand
```

The app is a static site (plain JavaScript and CSS, built with Vite), so `dist/` can be hosted anywhere.

## Project layout

```
index.html            page shell
src/main.js           rendering, filters, cookbook
src/search.js         search and ranking (pure functions, tested)
src/categories.js     courses, cuisines and the rules that sort new recipes into them
src/difficulty.js     the Easy / Medium / Challenge scale and how it's worked out
src/styles.css        the look: warm kitchen palette, order-ticket recipe cards
scripts/crawl.mjs     the recipe collector
scripts/lib/          schema.org, robots.txt, sitemap and tagging helpers
public/data/          chefs and collected recipes
test/                 node:test suites
```
