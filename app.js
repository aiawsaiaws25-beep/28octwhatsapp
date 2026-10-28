(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- WhatsApp helpers ----------
  const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

  const propertyMessage = (p, extra = "") =>
    [
      `Hello! I'm interested in this property${extra ? " " + extra : ""}:`,
      ``,
      `*${p.title}*`,
      `Ref: ${p.id}`,
      `Location: ${p.area}`,
      `Price: ${formatPrice(p)}`,
      `${bedLabel(p.beds)} · ${p.baths} bath · ${p.size.toLocaleString()} sqft`,
      ``,
      `Could you share more details?`,
    ].join("\n");

  // Any element with data-wa="message" becomes a WhatsApp link
  $$("[data-wa]").forEach((a) => (a.href = waLink(a.dataset.wa)));

  // ---------- Formatting ----------
  const fmtAED = (n) => "AED " + n.toLocaleString("en-US");
  const formatPrice = (p) => fmtAED(p.price) + (p.purpose === "rent" ? " / year" : "");
  const bedLabel = (b) => (b === 0 ? "Studio" : `${b} bed`);

  // ---------- State ----------
  const FAV_KEY = "skyline-favs";
  let favs = new Set();
  try { favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); } catch {}
  const saveFavs = () => {
    try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch {}
    $("#favCount").textContent = favs.size;
  };

  const state = { purpose: "all", text: "", type: "", beds: "", maxPrice: "", sort: "featured", onlyFavs: false };

  // ---------- Areas ----------
  const areas = [...new Set(PROPERTIES.map((p) => p.area))];
  $("#areaList").innerHTML = areas.map((a) => `<option value="${a}">`).join("");

  $("#areasGrid").innerHTML = areas
    .map((a) => {
      const list = PROPERTIES.filter((p) => p.area === a);
      return `<button class="area" data-area="${a}">
        <img src="${list[0].images[0]}" alt="" loading="lazy" onerror="this.remove()" />
        <span class="area__label"><b>${a}</b><small>${list.length} listing${list.length > 1 ? "s" : ""}</small></span>
      </button>`;
    })
    .join("");

  $("#areasGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-area]");
    if (!btn) return;
    $("#qText").value = btn.dataset.area;
    applySearch();
    $("#listings").scrollIntoView({ behavior: "smooth" });
  });

  // ---------- Filtering & rendering ----------
  function filtered() {
    const t = state.text.trim().toLowerCase();
    let list = PROPERTIES.filter(
      (p) =>
        (state.purpose === "all" || p.purpose === state.purpose) &&
        (!t || `${p.area} ${p.title} ${p.id}`.toLowerCase().includes(t)) &&
        (!state.type || p.type === state.type) &&
        (state.beds === "" || (state.beds === "0" ? p.beds === 0 : p.beds >= +state.beds)) &&
        (!state.maxPrice || p.price <= +state.maxPrice) &&
        (!state.onlyFavs || favs.has(p.id))
    );
    const sorters = {
      featured: (a, b) => b.featured - a.featured,
      "price-asc": (a, b) => a.price - b.price,
      "price-desc": (a, b) => b.price - a.price,
      "size-desc": (a, b) => b.size - a.size,
    };
    return list.sort(sorters[state.sort]);
  }

  function card(p) {
    const fav = favs.has(p.id);
    return `<article class="card" data-id="${p.id}">
      <div class="card__media">
        <img src="${p.images[0]}" alt="${p.title}" loading="lazy" onerror="this.remove()" />
        <span class="pill pill--${p.purpose}">${p.purpose === "buy" ? "For sale" : "For rent"}</span>
        ${p.featured ? '<span class="pill pill--featured">Featured</span>' : ""}
        <button class="fav ${fav ? "is-on" : ""}" data-fav="${p.id}" aria-label="Save property" aria-pressed="${fav}">♥</button>
      </div>
      <div class="card__body">
        <div class="card__price">${fmtAED(p.price)}${p.purpose === "rent" ? "<small> / yr</small>" : ""}</div>
        <h3 class="card__title">${p.title}</h3>
        <p class="muted card__loc">📍 ${p.area} · ${p.type}</p>
        <div class="card__specs">
          <span>🛏 ${bedLabel(p.beds)}</span><span>🛁 ${p.baths}</span><span>📐 ${p.size.toLocaleString()} sqft</span>
        </div>
        <div class="card__actions">
          <a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="${waLink(propertyMessage(p))}" data-stop>
            <svg class="wa-icon" viewBox="0 0 32 32"><use href="#wa" /></svg> WhatsApp
          </a>
          <button class="btn btn--ghost btn--sm" data-open="${p.id}">Details</button>
        </div>
      </div>
    </article>`;
  }

  function render() {
    const list = filtered();
    $("#grid").innerHTML = list.map(card).join("");
    $("#empty").hidden = list.length > 0;
    $("#resultCount").textContent = `${list.length} propert${list.length === 1 ? "y" : "ies"}`;
    $("#listingsTitle").textContent = state.onlyFavs
      ? "Your saved properties"
      : state.purpose === "buy" ? "Properties for sale"
      : state.purpose === "rent" ? "Properties for rent"
      : "Properties for you";

    const wanted = [
      state.purpose !== "all" && (state.purpose === "buy" ? "to buy" : "to rent"),
      state.type && `a ${state.type.toLowerCase()}`,
      state.beds && `${state.beds}+ bedrooms`,
      state.text && `in ${state.text}`,
      state.maxPrice && `budget up to ${fmtAED(+state.maxPrice)}`,
    ].filter(Boolean).join(", ");
    $("#emptyWa").href = waLink(`Hello! I'm looking for a property${wanted ? " " + wanted : ""}. Do you have any options?`);
  }

  function applySearch() {
    state.text = $("#qText").value;
    state.type = $("#qType").value;
    state.beds = $("#qBeds").value;
    state.maxPrice = $("#qPrice").value;
    state.onlyFavs = false;
    render();
  }

  function setPurpose(purpose) {
    state.purpose = purpose;
    $$(".search .tab").forEach((t) => t.classList.toggle("is-active", t.dataset.purpose === purpose));
  }

  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    applySearch();
    $("#listings").scrollIntoView({ behavior: "smooth" });
  });
  $$(".search .tab").forEach((t) => t.addEventListener("click", () => { setPurpose(t.dataset.purpose); render(); }));
  $$("[data-filter-purpose]").forEach((a) =>
    a.addEventListener("click", () => { setPurpose(a.dataset.filterPurpose); state.onlyFavs = false; render(); closeMenu(); })
  );
  $("#sortBy").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("#resetBtn").addEventListener("click", () => {
    $("#searchForm").reset();
    setPurpose("all");
    applySearch();
  });
  $("#favToggle").addEventListener("click", () => {
    state.onlyFavs = !state.onlyFavs;
    render();
    $("#listings").scrollIntoView({ behavior: "smooth" });
  });

  $("#grid").addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) {
      const id = favBtn.dataset.fav;
      favs.has(id) ? favs.delete(id) : favs.add(id);
      saveFavs();
      favBtn.classList.toggle("is-on", favs.has(id));
      favBtn.setAttribute("aria-pressed", favs.has(id));
      if (state.onlyFavs) render();
      return;
    }
    if (e.target.closest("[data-stop]")) return;
    const c = e.target.closest(".card");
    if (c) openModal(c.dataset.id);
  });

  // ---------- Modal ----------
  let current = null, photo = 0;

  function showPhoto(i) {
    photo = (i + current.images.length) % current.images.length;
    const im = $("#mImg");
    im.style.display = "";
    im.onerror = () => (im.style.display = "none");
    im.src = current.images[photo];
    $$("#mDots span").forEach((d, k) => d.classList.toggle("is-active", k === photo));
  }

  function openModal(id) {
    current = PROPERTIES.find((p) => p.id === id);
    if (!current) return;
    const p = current;
    $("#mImg").alt = p.title;
    $("#mDots").innerHTML = p.images.map(() => "<span></span>").join("");
    showPhoto(0);
    $("#mPurpose").textContent = p.purpose === "buy" ? "For sale" : "For rent";
    $("#mPurpose").className = `pill pill--${p.purpose}`;
    $("#mTitle").textContent = p.title;
    $("#mLoc").textContent = `📍 ${p.area}, Dubai · Ref ${p.id}`;
    $("#mPrice").textContent = formatPrice(p);
    $("#mSpecs").innerHTML = [
      ["Type", p.type], ["Bedrooms", bedLabel(p.beds)], ["Bathrooms", p.baths], ["Size", `${p.size.toLocaleString()} sqft`],
    ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join("");
    $("#mDesc").textContent = p.desc;
    $("#mAmen").innerHTML = p.amenities.map((a) => `<li>${a}</li>`).join("");
    $("#mWa").href = waLink(propertyMessage(p));
    $("#mViewing").href = waLink(propertyMessage(p, "and would like to book a viewing").replace(
      "Could you share more details?", "When is the earliest available viewing slot?"));
    $("#modal").hidden = false;
    document.body.style.overflow = "hidden";
    history.replaceState(null, "", `#${p.id}`);
  }

  function closeModal() {
    $("#modal").hidden = true;
    document.body.style.overflow = "";
    history.replaceState(null, "", location.pathname + location.search);
  }

  $("#modal").addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  $("#mPrev").addEventListener("click", () => showPhoto(photo - 1));
  $("#mNext").addEventListener("click", () => showPhoto(photo + 1));
  document.addEventListener("keydown", (e) => {
    if ($("#modal").hidden) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowLeft") showPhoto(photo - 1);
    if (e.key === "ArrowRight") showPhoto(photo + 1);
  });

  // ---------- Mortgage calculator ----------
  function calc() {
    const price = +$("#cPrice").value || 0;
    const downPct = +$("#cDown").value;
    const rate = (+$("#cRate").value || 0) / 100 / 12;
    const n = (+$("#cYears").value || 1) * 12;
    const loan = price * (1 - downPct / 100);
    const monthly = rate ? (loan * rate) / (1 - Math.pow(1 + rate, -n)) : loan / n;
    $("#cDownLabel").textContent = `${downPct}% (${fmtAED(Math.round((price * downPct) / 100))})`;
    $("#cResult").textContent = fmtAED(Math.round(monthly));
    $("#cLoan").textContent = `Loan amount ${fmtAED(Math.round(loan))} over ${n / 12} years`;
    $("#calcWa").href = waLink(
      `Hello! I'd like help with a mortgage.\nProperty price: ${fmtAED(price)}\nDown payment: ${downPct}%\nTerm: ${n / 12} years\nEstimated monthly: ${fmtAED(Math.round(monthly))}`
    );
  }
  $("#calcForm").addEventListener("input", calc);
  $("#calcForm").addEventListener("submit", (e) => e.preventDefault());

  // ---------- Contact form → WhatsApp ----------
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (id) => $(id).value.trim();
    const lines = [
      `Hello, my name is ${v("#fName")}.`,
      `I want to: ${v("#fIntent")}`,
      v("#fArea") && `Preferred area: ${v("#fArea")}`,
      v("#fBudget") && `Budget: AED ${v("#fBudget")}`,
      v("#fMsg") && `\n${v("#fMsg")}`,
    ].filter(Boolean);
    window.open(waLink(lines.join("\n")), "_blank", "noopener");
  });

  // ---------- Mobile menu ----------
  const closeMenu = () => $("#nav").classList.remove("is-open");
  $("#menuBtn").addEventListener("click", () => $("#nav").classList.toggle("is-open"));
  $$("#nav a").forEach((a) => a.addEventListener("click", closeMenu));

  // ---------- Init ----------
  $("#year").textContent = new Date().getFullYear();
  saveFavs();
  render();
  calc();
  const deepLink = location.hash.slice(1);
  if (PROPERTIES.some((p) => p.id === deepLink)) openModal(deepLink);
})();
