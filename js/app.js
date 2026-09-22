/* ============================================================
   Mandi Nibs — app.js
   Wires up state, renders every view, and handles all user
   interaction: city/category filters, tabs, theme + language
   toggles, gainers/losers horizon switch, geo comparison,
   thali index, docs, and the shopping basket drawer.
   ============================================================ */

const state = {
  lang: localStorage.getItem("mandiNibs.lang") || "en",
  theme: localStorage.getItem("mandiNibs.theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  city: localStorage.getItem("mandiNibs.city") || "All Cities",
  category: "All",
  glHorizon: "vsWeek", // gainers/losers horizon key
  geoLevel: "byCity",
  geoCommodity: null,
  tab: "home",
  rows: [],
  allDates: [],
  latestDate: null,
  analytics: null,
  dataSource: "live"
};

const T = {
  en: {
    tagline: "Today's mandi prices, before you head out",
    compositeIndex: "Composite Index",
    topGainers: "Top Gainers",
    bestDeals: "Best Deals",
    allProduce: "All Produce",
    compare: "Compare",
    thali: "Thali Cost",
    docs: "Guide",
    home: "Home",
    basket: "Basket",
    addToBasket: "Add",
    added: "Added",
    vsYesterday: "vs Yesterday",
    vsWeek: "vs Last Week",
    vsMonth: "vs Last Month",
    vsYear: "vs Last Year",
    value: "Value Buy",
    normal: "Normal",
    pricey: "Pricey",
    yourBasket: "Your Basket",
    estTotal: "Estimated total",
    estSavings: "Est. savings vs last week",
    shareWhatsApp: "Share on WhatsApp",
    copyList: "Copy as text",
    emptyBasket: "Your basket is empty. Add value picks from Home.",
    state: "State", district: "District", city: "City", mandi: "Mandi",
    thaliDesc: "Cost to cook one standard home-style thali today, using modal mandi prices.",
    feedback: "Feedback / Report a Mandi Price",
    liveData: "Live mandi data",
    sampleData: "Showing sample data — live feed unavailable right now",
    allCities: "All Cities"
  },
  hi: {
    tagline: "बाज़ार जाने से पहले आज के मंडी भाव",
    compositeIndex: "समग्र सूचकांक",
    topGainers: "सबसे महंगे",
    bestDeals: "सबसे सस्ते",
    allProduce: "सभी उत्पाद",
    compare: "तुलना",
    thali: "थाली लागत",
    docs: "गाइड",
    home: "होम",
    basket: "टोकरी",
    addToBasket: "जोड़ें",
    added: "जुड़ गया",
    vsYesterday: "कल की तुलना में",
    vsWeek: "पिछले सप्ताह की तुलना में",
    vsMonth: "पिछले महीने की तुलना में",
    vsYear: "पिछले साल की तुलना में",
    value: "सस्ता",
    normal: "सामान्य",
    pricey: "महंगा",
    yourBasket: "आपकी टोकरी",
    estTotal: "अनुमानित कुल",
    estSavings: "पिछले सप्ताह की तुलना में बचत",
    shareWhatsApp: "व्हाट्सएप पर भेजें",
    copyList: "टेक्स्ट के रूप में कॉपी करें",
    emptyBasket: "आपकी टोकरी खाली है। होम से सस्ते विकल्प जोड़ें।",
    state: "राज्य", district: "ज़िला", city: "शहर", mandi: "मंडी",
    thaliDesc: "आज के मंडी भाव से एक सामान्य घरेलू थाली बनाने की लागत।",
    feedback: "प्रतिक्रिया / मंडी भाव रिपोर्ट करें",
    liveData: "लाइव मंडी डेटा",
    sampleData: "नमूना डेटा दिखाया जा रहा है — लाइव फ़ीड अभी उपलब्ध नहीं है",
    allCities: "सभी शहर"
  }
};
function t(key) { return (T[state.lang] && T[state.lang][key]) || T.en[key] || key; }

/* ------------------------------ Boot ----------------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme();
  applyLang();
  buildSelectors();
  bindGlobalControls();
  bindTabs();
  bindDrawer();
  setupFeedbackLink();

  const { rows, source, stale } = await MandiData.loadRows();
  state.rows = rows;
  state.dataSource = source;
  state.allDates = MandiData.uniqueDatesSorted(rows);
  state.latestDate = state.allDates[0] || null;

  if (stale) showStaleBanner();
  if (!state.latestDate) {
    renderEmptyState();
    return;
  }
  recompute();
  renderAll();
  setupFeedbackLink();
});

function recompute() {
  state.analytics = MandiData.buildAnalytics(state.rows, state.allDates, state.latestDate, {
    city: state.city === "All Cities" ? null : state.city,
    category: state.category
  });
}

/* --------------------------- Header controls --------------------------- */

function buildSelectors() {
  const citySel = document.getElementById("citySelect");
  citySel.innerHTML = `<option value="All Cities">${t("allCities")}</option>` +
    MandiData.CITY_LIST.map(c => `<option value="${c}">${c}</option>`).join("");
  citySel.value = state.city;

  const catRow = document.getElementById("categoryChips");
  catRow.innerHTML = MandiData.CATEGORY_LIST.map(c =>
    `<button class="chip${c === state.category ? " active" : ""}" data-cat="${c}">${c}</button>`
  ).join("");
}

function bindGlobalControls() {
  document.getElementById("citySelect").addEventListener("change", e => {
    state.city = e.target.value;
    localStorage.setItem("mandiNibs.city", state.city);
    recompute();
    renderAll();
  });

  document.getElementById("categoryChips").addEventListener("click", e => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.category = btn.dataset.cat;
    document.querySelectorAll("#categoryChips .chip").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    recompute();
    renderAll();
  });

  document.getElementById("themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("mandiNibs.theme", state.theme);
    applyTheme();
  });

  document.getElementById("langToggle").addEventListener("click", () => {
    state.lang = state.lang === "en" ? "hi" : "en";
    localStorage.setItem("mandiNibs.lang", state.lang);
    applyLang();
    buildSelectors();
    renderAll();
  });
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  document.getElementById("themeToggle").textContent = state.theme === "dark" ? "☀️" : "🌙";
}
function applyLang() {
  document.getElementById("langToggle").textContent = state.lang === "en" ? "हिं" : "EN";
  document.querySelectorAll("[data-t]").forEach(el => { el.textContent = t(el.dataset.t); });
}

function setupFeedbackLink() {
  const link = document.getElementById("feedbackLink");
  if (!link) return;
  const context = `App: Mandi Nibs%0ABrowser: ${encodeURIComponent(navigator.userAgent)}%0AScreen: ${window.innerWidth}x${window.innerHeight}%0ACity: ${encodeURIComponent(state.city)}%0ADate: ${encodeURIComponent(state.latestDate || "")}%0A%0AMy feedback: `;
  link.href = `mailto:?subject=${encodeURIComponent("[MandiIndex Feedback]")}&body=${context}`;
}

function showStaleBanner() {
  document.getElementById("staleBanner").classList.remove("hidden");
  document.getElementById("staleBanner").textContent = t("sampleData");
}

/* ------------------------------- Tabs ----------------------------------- */

function bindTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + state.tab));
      if (state.tab === "compare") renderCompare();
      if (state.tab === "thali") renderThali();
      window.scrollTo({ top: 0 });
    });
  });
}

/* ------------------------------ Render all ------------------------------ */

function renderAll() {
  renderHero();
  renderGainersLosers();
  renderProduceList();
  if (state.tab === "compare") renderCompare();
  if (state.tab === "thali") renderThali();
  renderBasketFab();
}

function renderEmptyState() {
  document.getElementById("view-home").innerHTML = `
    <div class="empty-state">
      <div class="big">🧺</div>
      <p>No mandi data available right now. Please check back after the next refresh (7–8 AM IST).</p>
    </div>`;
}

/* -------------------------------- Hero ----------------------------------- */

function renderHero() {
  const a = state.analytics;
  const el = document.getElementById("heroCard");
  if (!a) { el.innerHTML = `<div class="skeleton" style="height:150px"></div>`; return; }

  const delta = a.compositeChange;
  const deltaClass = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const arrow = delta > 0.5 ? "▲" : delta < -0.5 ? "▼" : "•";
  const sentimentClass = a.sentiment === "Buyer's Market" ? "buyers" : a.sentiment === "Price Spike Warning" ? "spike" : "stable";
  const sentimentLabel = state.lang === "hi"
    ? (a.sentiment === "Buyer's Market" ? "खरीदार बाज़ार" : a.sentiment === "Price Spike Warning" ? "मूल्य वृद्धि चेतावनी" : "स्थिर बाज़ार")
    : a.sentiment;

  const dateLabel = new Date(a.latestDate + "T00:00:00").toLocaleDateString(state.lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
  const cityLabel = state.city === "All Cities" ? t("allCities") : state.city;

  el.innerHTML = `
    <div class="hero-label">${t("compositeIndex")} · ${cityLabel} · ${dateLabel}</div>
    <div class="hero-index-row">
      <span class="hero-index">${a.compositeIndex.toFixed(1)}</span>
      <span class="hero-delta ${deltaClass}">${arrow} ${Math.abs(delta).toFixed(1)}%</span>
    </div>
    <span class="sentiment-badge ${sentimentClass}">${sentimentLabel}</span>
    <div class="hero-sub">${t("tagline")}</div>
    <canvas id="trendSpark" height="46" style="margin-top:12px;width:100%"></canvas>
  `;
  renderSparkline();
}

let sparkChart = null;
function renderSparkline() {
  const canvas = document.getElementById("trendSpark");
  if (!canvas || typeof Chart === "undefined") return;
  const trend = MandiData.compositeTrend(state.rows, state.allDates, state.latestDate, {
    city: state.city === "All Cities" ? null : state.city,
    category: state.category
  }, 7);
  if (trend.length < 2) { canvas.style.display = "none"; return; }
  canvas.style.display = "block";
  const styles = getComputedStyle(document.documentElement);
  const lineColor = styles.getPropertyValue("--turmeric-deep").trim();
  if (sparkChart) sparkChart.destroy();
  sparkChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: trend.map(p => p.date.slice(5)),
      datasets: [{
        data: trend.map(p => p.index),
        borderColor: lineColor,
        backgroundColor: "transparent",
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      elements: { line: { borderJoinStyle: "round" } }
    }
  });
}

/* --------------------------- Gainers / Losers ---------------------------- */

function bindGlHorizonTabs() {
  document.getElementById("glHorizonTabs").addEventListener("click", e => {
    const btn = e.target.closest(".horizon-tab");
    if (!btn) return;
    state.glHorizon = btn.dataset.h;
    document.querySelectorAll("#glHorizonTabs .horizon-tab").forEach(b => b.classList.toggle("active", b === btn));
    renderGainersLosers();
  });
}

function renderGainersLosers() {
  const a = state.analytics;
  if (!a) return;
  const { gainers, losers } = MandiData.topGainersLosers(a.items, state.glHorizon, 10);

  document.getElementById("gainersScroller").innerHTML = gainers.map(cardHtml).join("") ||
    `<div class="empty-state" style="padding:20px">—</div>`;
  document.getElementById("losersScroller").innerHTML = losers.map(cardHtml).join("") ||
    `<div class="empty-state" style="padding:20px">—</div>`;

  bindAddButtons();
}

function cardHtml(item) {
  const change = item[state.glHorizon];
  const changeClass = change > 0 ? "up" : "down";
  const arrow = change > 0 ? "+" : "";
  const hindiLine = state.lang === "hi" && item.hindi ? `<div class="phindi">${item.hindi}</div>` : "";
  return `
    <div class="produce-card">
      <div class="pname">${item.name}</div>
      ${hindiLine}
      <div class="pprice">₹${Math.round(item.price)}</div>
      <div class="pchange ${changeClass}">${arrow}${change.toFixed(1)}%</div>
      <button class="add-fab" data-add="${escAttr(item.commodity)}">+ ${t("addToBasket")}</button>
    </div>`;
}

/* ------------------------------ Produce list ----------------------------- */

function renderProduceList() {
  const a = state.analytics;
  const list = document.getElementById("produceList");
  if (!a) { list.innerHTML = ""; return; }

  const essentials = a.items.filter(it => MandiData.ESSENTIALS.includes(it.commodity));
  const rest = a.items.filter(it => !MandiData.ESSENTIALS.includes(it.commodity))
    .sort((x, y) => x.name.localeCompare(y.name));
  const ordered = [...essentials, ...rest];

  list.innerHTML = ordered.map(rowHtml).join("");
  bindAddButtons();
}

function rowHtml(item) {
  const hindiLine = state.lang === "hi" && item.hindi ? `<div class="rhindi">${item.hindi}</div>` : "";
  return `
    <div class="produce-row">
      <div class="rinfo">
        <div class="rname">${item.name}</div>
        ${hindiLine}
        <div style="margin-top:4px"><span class="tag ${item.valueTag}">${t(item.valueTag)}</span></div>
      </div>
      <div style="text-align:right">
        <div class="rprice">₹${Math.round(item.price)}</div>
        <div style="font-size:11px;color:var(--muted)">${fmtChange(item.vsYesterday)} ${t("vsYesterday")}</div>
      </div>
      <button class="row-add-btn" data-add="${escAttr(item.commodity)}">+</button>
    </div>`;
}
function fmtChange(v) {
  if (v == null) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(1) + "%";
}
function escAttr(s) { return s.replace(/"/g, "&quot;"); }

function bindAddButtons() {
  document.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const commodity = btn.dataset.add;
      const item = state.analytics.items.find(it => it.commodity === commodity);
      if (!item) return;
      ShoppingList.add(item);
      btn.classList.add("added");
      if (btn.classList.contains("row-add-btn")) btn.textContent = "✓";
      else btn.textContent = "✓ " + t("added");
      renderBasketFab();
    });
  });
}

/* ------------------------------- Compare tab ------------------------------ */

function renderCompare() {
  const a = state.analytics;
  const wrap = document.getElementById("compareBody");
  if (!a || a.items.length === 0) { wrap.innerHTML = ""; return; }

  if (!state.geoCommodity || !a.items.some(it => it.commodity === state.geoCommodity)) {
    state.geoCommodity = a.items[0].commodity;
  }

  const options = a.items.map(it => `<option value="${escAttr(it.commodity)}" ${it.commodity === state.geoCommodity ? "selected" : ""}>${it.name}</option>`).join("");

  const geo = MandiData.geoComparison(state.rows, state.geoCommodity, state.latestDate);
  const levels = [
    { key: "byState", label: t("state") },
    { key: "byDistrict", label: t("district") },
    { key: "byCity", label: t("city") },
    { key: "byMandi", label: t("mandi") }
  ];

  wrap.innerHTML = `
    <select class="pill-select" id="geoCommoditySelect" style="width:100%;margin-bottom:12px">${options}</select>
    <div class="geo-tabs">
      ${levels.map(l => `<button class="chip${state.geoLevel === l.key ? " active" : ""}" data-geo="${l.key}">${l.label}</button>`).join("")}
    </div>
    <div id="geoTableWrap"></div>
  `;

  document.getElementById("geoCommoditySelect").addEventListener("change", e => {
    state.geoCommodity = e.target.value;
    renderCompare();
  });
  wrap.querySelectorAll("[data-geo]").forEach(btn => {
    btn.addEventListener("click", () => { state.geoLevel = btn.dataset.geo; renderCompare(); });
  });

  renderGeoTable(geo[state.geoLevel]);
}

function renderGeoTable(rows) {
  const wrap = document.getElementById("geoTableWrap");
  if (!wrap) return;
  if (!rows || rows.length === 0) { wrap.innerHTML = `<div class="empty-state">—</div>`; return; }
  const max = Math.max(...rows.map(r => r.avg));
  wrap.innerHTML = `
    <table class="geo-table">
      <thead><tr><th>${t("mandi")}</th><th>₹/kg</th><th style="width:40%"></th></tr></thead>
      <tbody>
        ${rows.slice(0, 20).map(r => `
          <tr>
            <td>${r.label}</td>
            <td>₹${r.avg.toFixed(1)}</td>
            <td><div class="geo-bar-bg"><div class="geo-bar-fill" style="width:${(r.avg / max * 100).toFixed(0)}%"></div></div></td>
          </tr>`).join("")}
      </tbody>
    </table>`;
}

/* -------------------------------- Thali tab -------------------------------- */

function renderThali() {
  const a = state.analytics;
  const wrap = document.getElementById("thaliBody");
  if (!a) { wrap.innerHTML = ""; return; }
  const th = MandiData.thaliCost(a.items);

  const deltaClass = th.deltaPct > 0.5 ? "up" : th.deltaPct < -0.5 ? "down" : "flat";
  const deltaTxt = th.deltaPct != null ? `${th.deltaPct > 0 ? "+" : ""}${th.deltaPct.toFixed(1)}% ${t("vsWeek").toLowerCase()}` : "";

  wrap.innerHTML = `
    <div class="thali-card">
      <div class="hero-label">${t("thali")}</div>
      <div class="thali-total">₹${th.total.toFixed(0)}</div>
      <div class="hero-delta ${deltaClass}" style="font-size:13px">${deltaTxt}</div>
      <p style="font-size:13px;color:var(--muted);margin:10px 0 14px">${t("thaliDesc")}</p>
      ${th.lines.map(l => `
        <div class="thali-line">
          <span>${l.name} · ${l.qty}kg</span>
          <span>${l.cost != null ? "₹" + l.cost.toFixed(1) : "—"}</span>
        </div>`).join("")}
    </div>
  `;
}

/* ------------------------------- Basket drawer ------------------------------ */

function renderBasketFab() {
  const fab = document.getElementById("basketFab");
  const count = ShoppingList.count();
  fab.querySelector(".count").textContent = count;
  fab.style.display = count > 0 ? "flex" : "none";
}

function bindDrawer() {
  const backdrop = document.getElementById("drawerBackdrop");
  const drawer = document.getElementById("basketDrawer");

  document.getElementById("basketFab").addEventListener("click", openDrawer);
  document.getElementById("drawerCloseBtn").addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);

  document.getElementById("shareWhatsAppBtn").addEventListener("click", () => ShoppingList.shareWhatsApp(state.lang));
  document.getElementById("copyListBtn").addEventListener("click", (e) => {
    ShoppingList.copyToNotepad(state.lang);
    const orig = e.target.textContent;
    e.target.textContent = "✓";
    setTimeout(() => { e.target.textContent = orig; }, 1200);
  });

  function openDrawer() {
    renderDrawerContents();
    backdrop.classList.add("open");
    drawer.classList.add("open");
  }
  function closeDrawer() {
    backdrop.classList.remove("open");
    drawer.classList.remove("open");
  }
  window.closeMandiDrawer = closeDrawer;
}

function renderDrawerContents() {
  const body = document.getElementById("drawerBody");
  const entries = Object.entries(ShoppingList.basket);

  if (entries.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="big">🧺</div><p>${t("emptyBasket")}</p></div>`;
  } else {
    body.innerHTML = entries.map(([key, it]) => `
      <div class="basket-row${it.checked ? " checked" : ""}" data-key="${escAttr(key)}">
        <div class="check-circle" data-check="${escAttr(key)}">${it.checked ? "✓" : ""}</div>
        <div style="flex:1">
          <div class="bname">${state.lang === "hi" && it.hindi ? it.hindi + " · " : ""}${it.name}</div>
          <div style="font-size:12px;color:var(--muted)">₹${Math.round(it.price)}/kg</div>
        </div>
        <div class="qty-controls">
          <button data-qty="-" data-key2="${escAttr(key)}">−</button>
          <span>${it.qty}kg</span>
          <button data-qty="+" data-key2="${escAttr(key)}">+</button>
        </div>
        <button class="basket-remove" data-remove="${escAttr(key)}">✕</button>
      </div>
    `).join("");
  }

  const s = ShoppingList.summary();
  document.getElementById("drawerSummary").innerHTML = `
    <div class="summary-row total"><span>${t("estTotal")}</span><span>₹${s.total.toFixed(0)}</span></div>
    ${s.savings > 1 ? `<div class="summary-row savings"><span>${t("estSavings")}</span><span>₹${s.savings.toFixed(0)}</span></div>` : ""}
  `;

  body.querySelectorAll("[data-check]").forEach(el => el.addEventListener("click", () => {
    ShoppingList.toggleChecked(el.dataset.check);
    renderDrawerContents();
  }));
  body.querySelectorAll("[data-remove]").forEach(el => el.addEventListener("click", () => {
    ShoppingList.remove(el.dataset.remove);
    renderDrawerContents();
    renderBasketFab();
  }));
  body.querySelectorAll("[data-qty]").forEach(el => el.addEventListener("click", () => {
    const key = el.dataset.key2;
    const cur = ShoppingList.basket[key];
    if (!cur) return;
    const delta = el.dataset.qty === "+" ? 0.25 : -0.25;
    ShoppingList.setQty(key, cur.qty + delta);
    renderDrawerContents();
  }));
}

/* Bind gainers/losers horizon tabs once DOM is present. */
document.addEventListener("DOMContentLoaded", bindGlHorizonTabs);
