# Mandi Nibs — Daily Produce Price Index

A mobile-first, fully client-side dashboard for daily mandi (wholesale market)
vegetable, fruit, grain, and pulse prices across major Indian cities. Built
by Suva.

No backend, no build step — it's plain HTML/CSS/JS that reads a published
Google Sheet CSV directly in the browser.

## What's inside

```
/
├── index.html              Main app shell + all view markup
├── css/
│   └── styles.css          Design system, layout, dark/light themes
├── js/
│   ├── data.js             CSV fetch/parse + all index/analytics math
│   ├── shoppingList.js     Basket state, WhatsApp/text export
│   └── app.js              UI rendering + interactions
├── data/
│   └── sample_produce.json Offline fallback data (used if the live feed fails)
├── assets/
│   └── og-image.png        Link-preview image (WhatsApp/Twitter/etc.)
└── README.md
```

## How it works

1. On load, the app fetches the published CSV at the URL set in
   `CSV_URL` inside `js/data.js` — this points at the Google Sheet fed by
   the Apps Script (`Daily_Prices` tab, refreshed 7–8 AM IST daily).
2. If that fetch fails (offline, sheet unpublished, CORS issue, etc.), it
   falls back to `data/sample_produce.json` and shows a small banner so
   users know they're looking at sample data.
3. Everything else — the composite index, sentiment, gainers/losers,
   multi-horizon badges, geo comparison, and the thali cost index — is
   computed client-side in `js/data.js` from whatever rows were loaded.

## Live URL

The app is currently hosted at **https://mandi.suvadipchakraborty.workers.dev/**
(Cloudflare Workers static assets). All absolute URLs in `index.html`
already point here.

## Deploying to Cloudflare Pages (GitHub upload)

1. Create a new GitHub repository (public or private).
2. Drag-and-drop every file/folder in this zip into the repo (keep the
   folder structure exactly as-is — `css/`, `js/`, `data/`, `assets/` at
   the repo root, alongside `index.html`).
3. Commit to the `main` branch.
4. In Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**, pick the repository.
5. Build settings: leave **Build command** empty and **Build output
   directory** as `/` (this is a static site, nothing to build).
6. Deploy. Cloudflare will give you a `*.pages.dev` URL immediately.

## Link preview (WhatsApp, Twitter, etc.)

`index.html` already has Open Graph and Twitter Card meta tags pointing at
`assets/og-image.png`, set to the live URL:

```
https://mandi.suvadipchakraborty.workers.dev/
```

WhatsApp and other apps need the **absolute** URL to fetch the preview
image, so a relative path won't work here. If you ever move the app to a
different domain, update every occurrence of the URL above in `index.html`
(`og:image`, `og:url`, `twitter:image`, `canonical`) to match.

## Updating the data source

The CSV URL, city list, and category list all live at the top of
`js/data.js`. If you change the published Google Sheet, republish it as
CSV (File → Share → Publish to web → CSV) and swap in the new `CSV_URL`.
The Apps Script reference (`variety-wise-daily-market-prices-data-commodity`
from data.gov.in) that populates the sheet is the one described in the
original project brief — it fetches the last 7 days plus a snapshot for
each of the last 12 months and same-day-last-year, so the app always has
enough history for every benchmarking horizon.

## Notes on the data

- Prices are ₹ per kg (the Apps Script divides the raw Agmarknet
  quintal price by 100).
- "Modal price" is the most commonly traded price at a mandi that day —
  this is what's shown as the headline number. Min/Max are also stored
  but not surfaced in the UI yet (fair game for a future addition, e.g. a
  price-range bar).
- If a city has no data for a given day, the app automatically falls back
  to the closest earlier date it can find for that benchmark.

## Customizing

- **Colors, type, spacing** — all in `css/styles.css` under `:root` /
  `[data-theme="dark"]`.
- **Essentials list & thali recipe** — `ESSENTIALS` and `THALI_RECIPE` in
  `js/data.js`.
- **Hindi labels** — `T.hi` in `js/app.js` (UI strings) and `HINDI_NAMES`
  in `js/data.js` (commodity names).

Built by Suva.
