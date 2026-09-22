/* ============================================================
   Mandi Nibs — shoppingList.js
   Interactive basket: add/remove items, quantities, running
   total, savings vs last week, checklist ("scratch-off") mode,
   and export to WhatsApp / plain text.
   ============================================================ */

const BASKET_KEY = "mandiNibs.basket.v1";

function loadBasket() {
  try {
    const raw = localStorage.getItem(BASKET_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveBasket(basket) {
  try { localStorage.setItem(BASKET_KEY, JSON.stringify(basket)); } catch {}
}

const ShoppingList = {
  basket: loadBasket(), // { commodity: { qty, unit, checked, priceSnapshot, weekPriceSnapshot, name } }

  add(item) {
    const key = item.commodity;
    if (!this.basket[key]) {
      this.basket[key] = {
        name: item.name,
        hindi: item.hindi,
        qty: 1,
        unit: "kg",
        checked: false,
        price: item.price,
        priceLastWeek: item.vsWeek != null ? item.price / (1 + item.vsWeek / 100) : item.price
      };
    }
    saveBasket(this.basket);
  },

  remove(key) {
    delete this.basket[key];
    saveBasket(this.basket);
  },

  setQty(key, qty) {
    if (!this.basket[key]) return;
    this.basket[key].qty = Math.max(0.25, Math.round(qty * 4) / 4);
    saveBasket(this.basket);
  },

  toggleChecked(key) {
    if (!this.basket[key]) return;
    this.basket[key].checked = !this.basket[key].checked;
    saveBasket(this.basket);
  },

  clear() {
    this.basket = {};
    saveBasket(this.basket);
  },

  count() {
    return Object.keys(this.basket).length;
  },

  summary() {
    let total = 0, lastWeekTotal = 0;
    Object.values(this.basket).forEach(it => {
      total += (it.price || 0) * it.qty;
      lastWeekTotal += (it.priceLastWeek || it.price || 0) * it.qty;
    });
    return { total, lastWeekTotal, savings: lastWeekTotal - total };
  },

  exportText(lang) {
    const t = (en, hi) => (lang === "hi" ? hi : en);
    const lines = [t("Mandi Nibs — Shopping List", "मंडी निब्स — खरीदारी सूची")];
    Object.entries(this.basket).forEach(([key, it]) => {
      const label = lang === "hi" && it.hindi ? `${it.hindi} (${it.name})` : it.name;
      lines.push(`${it.checked ? "✅" : "▫️"} ${label} — ${it.qty} kg @ ₹${Math.round(it.price)}/kg`);
    });
    const s = this.summary();
    lines.push("");
    lines.push(`${t("Estimated total", "अनुमानित कुल")}: ₹${Math.round(s.total)}`);
    if (s.savings > 1) {
      lines.push(`${t("Est. savings vs last week", "पिछले सप्ताह की तुलना में बचत")}: ₹${Math.round(s.savings)}`);
    }
    return lines.join("\n");
  },

  shareWhatsApp(lang) {
    const text = encodeURIComponent(this.exportText(lang));
    window.open(`https://wa.me/?text=${text}`, "_blank");
  },

  copyToNotepad(lang) {
    const text = this.exportText(lang);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    return text;
  }
};

window.ShoppingList = ShoppingList;
