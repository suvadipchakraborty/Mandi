/* ============================================================
   Mandi Nibs — data.js
   Fetches the published mandi price CSV, parses it, and turns
   raw rows into every number the UI needs: composite index,
   sentiment, gainers/losers, multi-horizon benchmarks, and the
   thali cost index. Falls back to bundled sample data offline.
   ============================================================ */

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTcZsAxQrRfyWwysEZjQiDi8cvV8drXHa21NCkfkaXdhLa14OKCrmHA1ioDhhaCq1ocr4ptOEMks718/pub?gid=0&single=true&output=csv";
const FALLBACK_URL = "data/sample_produce.json";

// Cities we surface as first-class filters (must match the "City" column
// values written by the Apps Script sync — see data/README notes).
const CITY_LIST = [
  "Delhi / NCR", "Mumbai", "Bengaluru", "Chennai", "Kolkata", "Hyderabad",
  "Ahmedabad", "Pune", "Agra", "Amritsar", "Bhopal", "Bhubaneswar",
  "Chandigarh", "Faridabad", "Ghaziabad", "Indore", "Jaipur", "Jamshedpur",
  "Kanpur", "Kochi", "Lucknow", "Mysuru", "Nagpur", "Patna", "Raipur",
  "Srinagar", "Surat", "Vadodara", "Visakhapatnam"
];

const CATEGORY_LIST = ["All", "Vegetables", "Fruits", "Cereals & Grains", "Pulses & Legumes"];

// Daily essentials get pinned to the top of any produce list and drive the
// default "Thali" basket.
const ESSENTIALS = ["Onion", "Potato", "Tomato", "Wheat", "Rice", "Bengal Gram(Gram)(Whole)"];

// A simple standard "thali" recipe: item -> kg needed per meal-basket.
const THALI_RECIPE = [
  { commodity: "Wheat", qty: 0.3 },
  { commodity: "Rice", qty: 0.2 },
  { commodity: "Onion", qty: 0.15 },
  { commodity: "Tomato", qty: 0.15 },
  { commodity: "Potato", qty: 0.2 },
  { commodity: "Bengal Gram(Gram)(Whole)", qty: 0.1 }
];

const DISPLAY_NAME_OVERRIDES = {
  "Bengal Gram(Gram)(Whole)": "Chana (Bengal Gram)",
  "Bhindi(Ladies Finger)": "Bhindi / Okra",
  "Cucumbar(Kheera)": "Cucumber",
  "Mousambi(Sweet Lime)": "Mousambi",
  "Ginger(Green)": "Ginger",
  "French Beans(Frasbean)": "French Beans",
  "Little gourd(Kundru)": "Kundru",
  "Pointed gourd(Parval)": "Parval",
  "Mango(Raw-Ripe)": "Mango",
  "Banana - Green": "Raw Banana",
  "Coriander(Leaves)": "Coriander",
  "Methi(Leaves)": "Methi",
  "Karbuja(Musk Melon)": "Muskmelon",
  "Chikoos(Sapota)": "Chikoo",
  "Paddy(Common)": "Paddy",
  "Paddy(Basmati)": "Basmati Paddy",
  "Green Gram(Moong)(Whole)": "Moong",
  "Black Gram(Urd Beans)(Whole)": "Urad",
  "Black Gram Dal(Urd Dal)": "Urad Dal",
  "Green Gram Dal(Moong Dal)": "Moong Dal",
  "Bengal Gram Dal(Chana Dal)": "Chana Dal"
};

const HINDI_NAMES = {
  "Onion": "प्याज़", "Potato": "आलू", "Tomato": "टमाटर", "Wheat": "गेहूं",
  "Rice": "चावल", "Garlic": "लहसुन", "Ginger(Green)": "अदरक", "Cabbage": "पत्तागोभी",
  "Cauliflower": "फूलगोभी", "Brinjal": "बैंगन", "Carrot": "गाजर", "Beetroot": "चुकंदर",
  "Green Chilli": "हरी मिर्च", "Bhindi(Ladies Finger)": "भिंडी", "Spinach": "पालक",
  "Cucumbar(Kheera)": "खीरा", "Capsicum": "शिमला मिर्च", "Pumpkin": "कद्दू",
  "Banana": "केला", "Apple": "सेब", "Mango": "आम", "Papaya": "पपीता",
  "Orange": "संतरा", "Pomegranate": "अनार", "Grapes": "अंगूर", "Guava": "अमरूद",
  "Lemon": "नींबू", "Pineapple": "अनानास", "Bengal Gram(Gram)(Whole)": "चना",
  "Coriander(Leaves)": "धनिया", "Methi(Leaves)": "मेथी", "Sweet Potato": "शकरकंद",
  "Raddish": "मूली", "Watermelon": "तरबूज", "Water Melon": "तरबूज"
};

function displayName(commodity) {
  return DISPLAY_NAME_OVERRIDES[commodity] || commodity;
}
function hindiName(commodity) {
  return HINDI_NAMES[commodity] || null;
}

/* ---------- CSV parsing (no external dependency; format is simple) ---- */

function parseCsv(text) {
  const lines = text.split(/\r\n|\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length < 10) continue;
    const [Date_, State, District, City, Mandi, Commodity, Category, Modal, Min, Max] = cells;
    const modal = parseFloat(Modal);
    if (!Commodity || !City || isNaN(modal) || modal <= 0) continue;
    rows.push({
      date: Date_.trim(),
      state: State.trim(),
      district: District.trim(),
      city: City.trim(),
      mandi: Mandi.trim(),
      commodity: Commodity.trim(),
      category: Category.trim(),
      modal,
      min: parseFloat(Min) || modal,
      max: parseFloat(Max) || modal
    });
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

/* ---------------------------- Fetch layer ------------------------------ */

async function loadRows() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("bad status " + res.status);
    const text = await res.text();
    const rows = parseCsv(text);
    if (rows.length === 0) throw new Error("empty csv");
    return { rows, source: "live", stale: false };
  } catch (err) {
    console.warn("Live CSV fetch failed, falling back to sample data:", err.message);
    try {
      const res = await fetch(FALLBACK_URL);
      const json = await res.json();
      return { rows: json, source: "sample", stale: true };
    } catch (err2) {
      console.error("Fallback sample data also failed:", err2.message);
      return { rows: [], source: "none", stale: true };
    }
  }
}

/* --------------------------- Index helpers ----------------------------- */

function uniqueDatesSorted(rows) {
  const set = new Set(rows.map(r => r.date));
  return Array.from(set).sort().reverse(); // newest first
}

function filterRows(rows, { date, city, category } = {}) {
  return rows.filter(r =>
    (!date || r.date === date) &&
    (!city || city === "All Cities" || r.city === city) &&
    (!category || category === "All" || r.category === category)
  );
}

function average(nums) {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Average modal price per commodity for a given slice of rows.
function avgPriceByCommodity(rows) {
  const map = {};
  rows.forEach(r => {
    if (!map[r.commodity]) map[r.commodity] = [];
    map[r.commodity].push(r.modal);
  });
  const out = {};
  Object.keys(map).forEach(k => { out[k] = average(map[k]); });
  return out;
}

function addDaysIso(iso, delta) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
function addMonthsIso(iso, delta) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, maxDay));
  return d.toISOString().slice(0, 10);
}
function addYearsIso(iso, delta) {
  return addMonthsIso(iso, delta * 12);
}

/**
 * Build the full analytics bundle for a given (city, category) view.
 * latestDate: iso string of the most recent date present in the data.
 */
function buildAnalytics(rows, allDates, latestDate, filters) {
  const today = filterRows(rows, { ...filters, date: latestDate });
  const todayAvg = avgPriceByCommodity(today);

  const horizonDate = {
    yesterday: nearestAvailable(allDates, addDaysIso(latestDate, -1), latestDate),
    lastWeek: nearestAvailable(allDates, addDaysIso(latestDate, -7), latestDate),
    lastMonth: nearestAvailable(allDates, addMonthsIso(latestDate, -1), latestDate),
    lastYear: nearestAvailable(allDates, addYearsIso(latestDate, -1), latestDate)
  };

  const weekWindow = allDates.filter(d => d <= latestDate && d >= addDaysIso(latestDate, -7));
  const weekAvg = avgPriceByCommodity(filterRows(rows, { ...filters }).filter(r => weekWindow.includes(r.date)));

  const monthWindow = allDates.filter(d => d <= latestDate && d >= addMonthsIso(latestDate, -1));
  const monthAvg = avgPriceByCommodity(filterRows(rows, { ...filters }).filter(r => monthWindow.includes(r.date)));

  const yestAvg = avgPriceByCommodity(filterRows(rows, { ...filters, date: horizonDate.yesterday }));
  const yearAvg = avgPriceByCommodity(filterRows(rows, { ...filters, date: horizonDate.lastYear }));
  // Exact same-day-last-month reading, distinct from the 30-day window
  // average above — used by the Gainers/Losers day-level toggle.
  const monthSameDayAvg = avgPriceByCommodity(filterRows(rows, { ...filters, date: horizonDate.lastMonth }));

  const commodities = Object.keys(todayAvg);

  const items = commodities.map(c => {
    const price = todayAvg[c];
    const vsYesterday = pctChange(price, yestAvg[c]);
    const vsWeek = pctChange(price, weekAvg[c]);
    const vsMonth = pctChange(price, monthAvg[c]);
    const vsYear = pctChange(price, yearAvg[c]);
    const vsMonthSameDay = pctChange(price, monthSameDayAvg[c]);
    const rowCat = (rows.find(r => r.commodity === c) || {}).category || "";
    return {
      commodity: c,
      name: displayName(c),
      hindi: hindiName(c),
      category: rowCat,
      price,
      vsYesterday, vsWeek, vsMonth, vsYear, vsMonthSameDay,
      valueTag: valueTag(vsWeek)
    };
  }).filter(it => it.price != null);

  // Composite index: simple equal-weighted average of vsWeek changes,
  // rebased to 100 (100 = flat vs last week average).
  const changes = items.map(it => it.vsWeek).filter(v => v != null);
  const compositeChange = average(changes) || 0;
  const compositeIndex = 100 + compositeChange;

  let sentiment = "Stable";
  if (compositeChange <= -4) sentiment = "Buyer's Market";
  else if (compositeChange >= 4) sentiment = "Price Spike Warning";

  return {
    latestDate,
    items,
    compositeIndex,
    compositeChange,
    sentiment,
    horizonDate
  };
}

function nearestAvailable(allDates, targetIso, fallback) {
  if (allDates.includes(targetIso)) return targetIso;
  // pick closest earlier date
  const earlier = allDates.filter(d => d <= targetIso).sort().reverse();
  return earlier[0] || fallback;
}

function pctChange(now, then) {
  if (now == null || then == null || then === 0) return null;
  return ((now - then) / then) * 100;
}

function valueTag(pctVsWeek) {
  if (pctVsWeek == null) return "normal";
  if (pctVsWeek <= -8) return "value";
  if (pctVsWeek >= 8) return "pricey";
  return "normal";
}

function topGainersLosers(items, horizonKey, limit = 8) {
  const withChange = items.filter(it => it[horizonKey] != null);
  const gainers = [...withChange].sort((a, b) => b[horizonKey] - a[horizonKey]).slice(0, limit);
  const losers = [...withChange].sort((a, b) => a[horizonKey] - b[horizonKey]).slice(0, limit);
  return { gainers, losers };
}

// Geographic roll-up: average modal price for a commodity at
// state / district / city / mandi granularity (for the comparison view).
function geoComparison(rows, commodity, latestDate) {
  const slice = rows.filter(r => r.commodity === commodity && r.date === latestDate);
  const rollup = (keyFn) => {
    const map = {};
    slice.forEach(r => {
      const k = keyFn(r);
      if (!k) return;
      if (!map[k]) map[k] = [];
      map[k].push(r.modal);
    });
    return Object.entries(map)
      .map(([k, v]) => ({ label: k, avg: average(v), count: v.length }))
      .sort((a, b) => a.avg - b.avg);
  };
  return {
    byState: rollup(r => r.state),
    byDistrict: rollup(r => r.district),
    byCity: rollup(r => r.city),
    byMandi: rollup(r => `${r.mandi} (${r.city})`)
  };
}

function thaliCost(items) {
  let total = 0;
  let totalLastWeek = 0;
  const lines = THALI_RECIPE.map(ing => {
    const item = items.find(it => it.commodity === ing.commodity);
    const price = item ? item.price : null;
    const cost = price != null ? price * ing.qty : null;
    const priceLastWeek = item && item.vsWeek != null ? price / (1 + item.vsWeek / 100) : price;
    const costLastWeek = priceLastWeek != null ? priceLastWeek * ing.qty : null;
    if (cost != null) total += cost;
    if (costLastWeek != null) totalLastWeek += costLastWeek;
    return { ...ing, name: displayName(ing.commodity), price, cost };
  });
  return { lines, total, totalLastWeek, deltaPct: pctChange(total, totalLastWeek) };
}

// A light-weight trend line for the hero sparkline: average modal price
// across whatever commodities are present each day, normalised to 100 on
// the earliest day in the window.
function compositeTrend(rows, allDates, latestDate, filters, days = 7) {
  const window_ = allDates.filter(d => d <= latestDate).slice(0, days).sort();
  const points = window_.map(d => {
    const dayRows = filterRows(rows, { ...filters, date: d });
    const byCommodity = avgPriceByCommodity(dayRows);
    const vals = Object.values(byCommodity).filter(v => v != null);
    return { date: d, avg: average(vals) };
  }).filter(p => p.avg != null);
  if (points.length === 0) return [];
  const base = points[0].avg;
  return points.map(p => ({ date: p.date, index: base ? (p.avg / base) * 100 : 100 }));
}

/**
 * Per-item price trend for the tap-to-expand chart on a produce card/row.
 * Matches the three data horizons the feed actually carries:
 *  - week:   one price per day for the trailing ~7 daily readings.
 *  - months: one price per month (same day-of-month) for the trailing 12
 *            months, resolved to the nearest earlier available date.
 *  - year:   a single same-day-last-year vs. today comparison — this is
 *            genuinely a 2-point series because that's the only reading
 *            the feed carries that far back.
 */
function itemTrend(rows, allDates, latestDate, commodity, filters = {}) {
  const priceOn = (date) => {
    const dayRows = filterRows(rows, { ...filters, date }).filter(r => r.commodity === commodity);
    return average(dayRows.map(r => r.modal));
  };

  const weekDates = allDates.filter(d => d <= latestDate && d >= addDaysIso(latestDate, -7)).sort();
  const week = weekDates
    .map(d => ({ date: d, price: priceOn(d) }))
    .filter(p => p.price != null);

  const seenMonthDates = new Set();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const anchor = addMonthsIso(latestDate, -i);
    const resolved = nearestAvailable(allDates, anchor, latestDate);
    if (seenMonthDates.has(resolved)) continue;
    seenMonthDates.add(resolved);
    const price = priceOn(resolved);
    if (price != null) months.push({ date: resolved, price });
  }

  const lastYearDate = nearestAvailable(allDates, addYearsIso(latestDate, -1), latestDate);
  const year = [
    { date: lastYearDate, price: priceOn(lastYearDate), kind: "lastYear" },
    { date: latestDate, price: priceOn(latestDate), kind: "today" }
  ].filter(p => p.price != null);

  return { week, months, year };
}

window.MandiData = {
  CITY_LIST, CATEGORY_LIST, ESSENTIALS, THALI_RECIPE,
  loadRows, uniqueDatesSorted, filterRows, buildAnalytics,
  topGainersLosers, geoComparison, thaliCost, compositeTrend, itemTrend,
  displayName, hindiName, pctChange
};
