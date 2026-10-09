const DRAFT_KEY = "plan100.draft.v1";
const REVIEW_KEY = "plan100.review.v1";

const STATUS_LABEL = {
  idea: "念头",
  planned: "打算做",
  doing: "进行中",
  done: "已完成",
};

const LANE_LABEL = {
  draft: "草稿",
  active: "活跃",
  dormant: "休眠",
  archived: "归档",
};

const state = {
  data: null,
  category: "all",
  status: "all",
  lane: "all",
  editingId: null,
  reviewSample: [],
};

const $ = (sel) => document.querySelector(sel);

async function boot() {
  const base = await loadBaseData();
  const draft = loadDraft();
  state.data = draft ? mergeDraft(base, draft) : structuredClone(base);
  normalizeGovernance();
  if (draft) {
    $("#progress-hint").textContent = "本地有未导出的草稿，记得导出后写回仓库。";
  }
  bindEvents();
  renderAll();
}

async function loadBaseData() {
  const res = await fetch("data/items.json", { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载 data/items.json");
  return res.json();
}

function normalizeGovernance() {
  const g = state.data.meta.governance || {};
  state.data.meta.governance = {
    activeSlots: g.activeSlots ?? 20,
    ttlDays: g.ttlDays ?? 90,
    archiveAfterDormantDays: g.archiveAfterDormantDays ?? 90,
  };
  for (const item of state.data.items) {
    if (!item.lane) item.lane = item.status === "idea" ? "draft" : "active";
    if (!item.renewed) item.renewed = item.added || today();
    if (item.whyLose == null) item.whyLose = "";
    if (item.signal == null) item.signal = "";
    if (item.mergeOf == null) item.mergeOf = "";
    if (item.lastReviewed == null) item.lastReviewed = "";
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft() {
  const payload = {
    updated: today(),
    items: state.data.items,
    meta: state.data.meta,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  state.data.meta.updated = payload.updated;
}

function mergeDraft(base, draft) {
  const next = structuredClone(base);
  if (Array.isArray(draft.items)) next.items = draft.items;
  if (draft.updated) next.meta.updated = draft.updated;
  if (draft.meta?.governance) {
    next.meta.governance = { ...next.meta.governance, ...draft.meta.governance };
  }
  return next;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(dateStr, days) {
  const d = parseDate(dateStr) || new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromStr, toStr = today()) {
  const a = parseDate(fromStr);
  const b = parseDate(toStr);
  if (!a || !b) return 0;
  return Math.floor((b - a) / 86400000);
}

function gov() {
  return state.data.meta.governance;
}

function activeItems() {
  return state.data.items.filter((i) => i.lane === "active");
}

function expiryOf(item) {
  return addDays(item.renewed || item.added || today(), gov().ttlDays);
}

function isExpired(item) {
  return item.lane === "active" && expiryOf(item) < today();
}

function dormantShouldArchive(item) {
  if (item.lane !== "dormant") return false;
  const base = item.renewed || item.added || today();
  return daysBetween(base) >= gov().archiveAfterDormantDays;
}

function bindEvents() {
  $("#status-filter").addEventListener("change", (e) => {
    state.status = e.target.value;
    renderList();
  });
  $("#lane-filter").addEventListener("change", (e) => {
    state.lane = e.target.value;
    renderList();
  });

  $("#btn-add").addEventListener("click", () => openModal());
  $("#btn-export").addEventListener("click", exportJson);
  $("#btn-reset-draft").addEventListener("click", resetDraft);
  $("#btn-apply-decay").addEventListener("click", applyDecay);
  $("#btn-review").addEventListener("click", openReview);
  $("#review-close").addEventListener("click", () => $("#review-modal").close());
  $("#review-reshuffle").addEventListener("click", () => {
    pickReviewSample();
    renderReview();
  });
  $("#review-done").addEventListener("click", finishReview);
  $("#btn-renew").addEventListener("click", renewCurrent);

  $("#field-lane").addEventListener("change", updateSlotHint);

  $("#item-form").addEventListener("submit", (e) => {
    const submitter = e.submitter;
    if (submitter?.value === "cancel") {
      state.editingId = null;
      return;
    }
    if (submitter?.value === "save") {
      e.preventDefault();
      if (saveFromForm()) $("#item-modal").close();
    }
  });
}

function renderAll() {
  const { meta, categories } = state.data;
  $("#site-title").textContent = meta.title;
  $("#site-subtitle").textContent = meta.subtitle;
  $("#count-goal").textContent = String(meta.goal);
  document.title = meta.title;

  renderFilters(categories);
  fillCategorySelect(categories);
  renderProgress();
  renderGov();
  renderStats();
  renderList();
}

function renderFilters(categories) {
  const root = $("#filters");
  const chips = [{ id: "all", name: "全部" }, ...categories];
  root.innerHTML = chips
    .map(
      (c) => `
      <button type="button" class="filter-chip" role="tab"
        data-category="${c.id}"
        aria-selected="${state.category === c.id}">
        ${c.name}
      </button>`
    )
    .join("");

  root.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.category;
      root.querySelectorAll(".filter-chip").forEach((b) => {
        b.setAttribute("aria-selected", String(b === btn));
      });
      renderList();
    });
  });
}

function fillCategorySelect(categories) {
  $("#field-category").innerHTML = categories
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");
}

function renderProgress() {
  const { items, meta } = state.data;
  const current = items.filter((i) => i.lane !== "archived").length;
  const goal = meta.goal || 100;
  $("#count-current").textContent = String(current);

  const circumference = 2 * Math.PI * 52;
  const ratio = Math.min(current / goal, 1);
  $("#ring-fill").style.strokeDashoffset = String(circumference * (1 - ratio));

  if (!localStorage.getItem(DRAFT_KEY)) {
    const expired = activeItems().filter(isExpired).length;
    if (expired) {
      $("#progress-hint").textContent = `${expired} 条活跃已过期，点「执行过期沉降」或续命。`;
    } else if (current === 0) {
      $("#progress-hint").textContent = "从今天的一个念头开始。";
    } else {
      $("#progress-hint").textContent = `活跃 ${activeItems().length}/${gov().activeSlots} 槽 · 收录 ${current}/${goal}`;
    }
  }
}

function renderGov() {
  const slots = gov().activeSlots;
  const active = activeItems().length;
  const expired = activeItems().filter(isExpired).length;
  const dormant = state.data.items.filter((i) => i.lane === "dormant").length;
  const archived = state.data.items.filter((i) => i.lane === "archived").length;
  const lastReview = localStorage.getItem(REVIEW_KEY);
  const reviewAge = lastReview ? daysBetween(lastReview) : null;

  $("#gov-metrics").innerHTML = `
    <div class="gov-chip ${active >= slots ? "warn" : ""}">
      <span class="k">活跃槽</span>
      <span class="v">${active}/${slots}</span>
    </div>
    <div class="gov-chip ${expired ? "warn" : ""}">
      <span class="k">已过期</span>
      <span class="v">${expired}</span>
    </div>
    <div class="gov-chip">
      <span class="k">休眠</span>
      <span class="v">${dormant}</span>
    </div>
    <div class="gov-chip">
      <span class="k">归档</span>
      <span class="v">${archived}</span>
    </div>
    <div class="gov-chip ${reviewAge == null || reviewAge >= 7 ? "warn" : ""}">
      <span class="k">质检</span>
      <span class="v">${lastReview ? `${reviewAge}天前` : "未做"}</span>
    </div>
  `;
}

function renderStats() {
  const { categories, items } = state.data;
  const visible = items.filter((i) => i.lane !== "archived");
  $("#stats").innerHTML = categories
    .map((c) => {
      const n = visible.filter((i) => i.category === c.id).length;
      return `
        <div class="stat-card">
          <span class="name">${c.name}</span>
          <span class="num">${n}</span>
        </div>`;
    })
    .join("");
}

function filteredItems() {
  return state.data.items
    .filter((i) => state.category === "all" || i.category === state.category)
    .filter((i) => state.status === "all" || i.status === state.status)
    .filter((i) => state.lane === "all" || i.lane === state.lane)
    .slice()
    .sort((a, b) => {
      const laneRank = { active: 0, draft: 1, dormant: 2, archived: 3 };
      const lr = (laneRank[a.lane] ?? 9) - (laneRank[b.lane] ?? 9);
      if (lr !== 0) return lr;
      return b.id - a.id;
    });
}

function categoryOf(id) {
  return state.data.categories.find((c) => c.id === id) || { name: "未分类", color: "#6e6e6e" };
}

function renderList() {
  const list = $("#item-list");
  const items = filteredItems();
  $("#empty-state").hidden = items.length > 0;

  list.innerHTML = items
    .map((item, idx) => {
      const cat = categoryOf(item.category);
      const delay = Math.min(idx, 8) * 40;
      const expired = isExpired(item);
      const exp = expiryOf(item);
      return `
        <li class="item ${expired ? "item-expired" : ""} lane-${item.lane}" style="animation-delay:${delay}ms" data-id="${item.id}">
          <div class="item-index">${String(item.id).padStart(2, "0")}</div>
          <div class="item-body">
            <h3>${escapeHtml(item.title)}</h3>
            <div class="item-meta">
              <span class="tag" style="color:${cat.color}">
                <span class="tag-dot"></span>${escapeHtml(cat.name)}
              </span>
              <span class="tag">${LANE_LABEL[item.lane] || item.lane}</span>
              <span class="tag">${STATUS_LABEL[item.status] || item.status}</span>
              ${expired ? `<span class="tag tag-warn">已过期</span>` : ""}
              ${item.source ? `<span class="tag">${escapeHtml(item.source)}</span>` : ""}
            </div>
            ${item.whyLose ? `<p class="item-note"><strong>若丢掉：</strong>${escapeHtml(item.whyLose)}</p>` : ""}
            ${item.signal ? `<p class="item-note"><strong>怎样算有价值：</strong>${escapeHtml(item.signal)}</p>` : ""}
            ${item.note ? `<p class="item-note">${escapeHtml(item.note)}</p>` : ""}
          </div>
          <div class="item-side">
            <span class="item-date">${item.lane === "active" ? `到期 ${escapeHtml(exp)}` : escapeHtml(item.added || "")}</span>
            <div class="item-actions">
              <button type="button" data-action="edit">编辑</button>
              ${item.lane === "active" ? `<button type="button" data-action="renew">续命</button>` : ""}
              <button type="button" data-action="delete">删除</button>
            </div>
          </div>
        </li>`;
    })
    .join("");

  list.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.closest(".item").dataset.id);
      if (btn.dataset.action === "edit") openModal(id);
      if (btn.dataset.action === "delete") removeItem(id);
      if (btn.dataset.action === "renew") renewItem(id);
    });
  });
}

function activeCountExcluding(id) {
  return state.data.items.filter((i) => i.lane === "active" && i.id !== id).length;
}

function updateSlotHint() {
  const lane = $("#field-lane").value;
  const slots = gov().activeSlots;
  const used = activeCountExcluding(state.editingId);
  const hint = $("#slot-hint");
  if (lane === "active") {
    if (used >= slots) {
      hint.textContent = `活跃槽已满（${used}/${slots}）。请先把别的条目降为休眠/归档，或改为草稿。`;
      hint.classList.add("warn");
    } else {
      hint.textContent = `保存为活跃将占用槽位（当前 ${used}/${slots}）。草稿/休眠/归档不占槽。`;
      hint.classList.remove("warn");
    }
  } else {
    hint.textContent = "草稿可先记念头；写得出「若丢掉」和「怎样算有价值」再升活跃。";
    hint.classList.remove("warn");
  }
}

function openModal(id) {
  state.editingId = id ?? null;
  const modal = $("#item-modal");
  $("#modal-title").textContent = id ? "编辑条目" : "记下一条";
  $("#btn-renew").hidden = !id;

  if (id) {
    const item = state.data.items.find((i) => i.id === id);
    if (!item) return;
    $("#field-title").value = item.title;
    $("#field-category").value = item.category;
    $("#field-status").value = item.status;
    $("#field-lane").value = item.lane || "draft";
    $("#field-why-lose").value = item.whyLose || "";
    $("#field-signal").value = item.signal || "";
    $("#field-merge-of").value = item.mergeOf || "";
    $("#field-source").value = item.source || "";
    $("#field-note").value = item.note || "";
  } else {
    $("#item-form").reset();
    $("#field-status").value = "idea";
    $("#field-lane").value = "draft";
  }

  updateSlotHint();
  modal.showModal();
  $("#field-title").focus();
}

function saveFromForm() {
  const title = $("#field-title").value.trim();
  const whyLose = $("#field-why-lose").value.trim();
  const signal = $("#field-signal").value.trim();
  const lane = $("#field-lane").value;
  const mergeOf = $("#field-merge-of").value.trim();

  if (!title) return false;

  if (lane === "active") {
    if (!whyLose || !signal) {
      alert("升入活跃槽必须填写出生证明：若丢掉会失去什么，以及怎样算有价值。");
      return false;
    }
    if (activeCountExcluding(state.editingId) >= gov().activeSlots) {
      alert(`活跃槽已满（${gov().activeSlots}）。请先沉降其他条目，或保存为草稿。`);
      return false;
    }
  }

  if (!state.editingId && !mergeOf) {
    const ok = confirm(
      "新建税：还没写「为何不能并入已有条目」。\n\n确定仍要新建？建议先逛列表看能否合并。"
    );
    if (!ok) return false;
  }

  const payload = {
    title,
    category: $("#field-category").value,
    status: $("#field-status").value,
    lane,
    whyLose,
    signal,
    mergeOf,
    source: $("#field-source").value.trim(),
    note: $("#field-note").value.trim(),
  };

  if (state.editingId) {
    const item = state.data.items.find((i) => i.id === state.editingId);
    const wasActive = item.lane === "active";
    Object.assign(item, payload);
    if (payload.lane === "active" && !wasActive) {
      item.renewed = today();
    }
  } else {
    const nextId =
      state.data.items.reduce((max, i) => Math.max(max, i.id), 0) + 1;
    state.data.items.push({
      id: nextId,
      ...payload,
      added: today(),
      renewed: today(),
      lastReviewed: "",
    });
  }

  state.editingId = null;
  persistAndRefresh("已写入本地草稿。导出 JSON 后写回仓库即可上线。");
  return true;
}

function renewCurrent() {
  if (!state.editingId) return;
  renewItem(state.editingId);
  $("#field-lane").value = "active";
  updateSlotHint();
}

function renewItem(id) {
  const item = state.data.items.find((i) => i.id === id);
  if (!item) return;
  if (!item.whyLose?.trim() || !item.signal?.trim()) {
    alert("续命前请先补全出生证明（若丢掉 / 怎样算有价值）。");
    openModal(id);
    return;
  }
  if (item.lane !== "active" && activeCountExcluding(id) >= gov().activeSlots) {
    alert("活跃槽已满，无法续命升槽。请先沉降其他条目。");
    return;
  }
  item.lane = "active";
  item.renewed = today();
  persistAndRefresh(`#${id} 已续命至 ${expiryOf(item)}。`);
}

function removeItem(id) {
  if (!confirm("确定删除这条吗？删除会写入本地草稿。")) return;
  state.data.items = state.data.items.filter((i) => i.id !== id);
  persistAndRefresh("已删除并写入本地草稿。");
}

function applyDecay() {
  let toDormant = 0;
  let toArchive = 0;
  for (const item of state.data.items) {
    if (isExpired(item)) {
      item.lane = "dormant";
      item.renewed = today();
      toDormant += 1;
    } else if (dormantShouldArchive(item)) {
      item.lane = "archived";
      toArchive += 1;
    }
  }
  if (!toDormant && !toArchive) {
    alert("没有需要沉降的条目。");
    return;
  }
  persistAndRefresh(`沉降完成：${toDormant} 条→休眠，${toArchive} 条→归档。`);
}

function pickReviewSample() {
  const pool = activeItems().slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  state.reviewSample = pool.slice(0, Math.min(3, pool.length));
}

function openReview() {
  pickReviewSample();
  renderReview();
  $("#review-modal").showModal();
}

function renderReview() {
  const list = $("#review-list");
  const empty = $("#review-empty");
  empty.hidden = state.reviewSample.length > 0;
  list.innerHTML = state.reviewSample
    .map(
      (item) => `
      <li class="review-item" data-id="${item.id}">
        <h3>${escapeHtml(item.title)}</h3>
        <p><strong>若丢掉：</strong>${escapeHtml(item.whyLose || "（未填）")}</p>
        <p><strong>怎样算有价值：</strong>${escapeHtml(item.signal || "（未填）")}</p>
        <p class="form-hint">杀伤测试：若它其实不重要，点「降为休眠」。</p>
        <div class="item-actions">
          <button type="button" data-review="keep">仍重要</button>
          <button type="button" data-review="dormant">降为休眠</button>
        </div>
      </li>`
    )
    .join("");

  list.querySelectorAll("[data-review]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.closest(".review-item").dataset.id);
      const item = state.data.items.find((i) => i.id === id);
      if (!item) return;
      if (btn.dataset.review === "dormant") {
        item.lane = "dormant";
        item.renewed = today();
      } else {
        item.lastReviewed = today();
      }
      btn.closest(".review-item").classList.add("reviewed");
      btn.parentElement.querySelectorAll("button").forEach((b) => {
        b.disabled = true;
      });
      saveDraft();
      renderGov();
      renderList();
    });
  });
}

function finishReview() {
  localStorage.setItem(REVIEW_KEY, today());
  for (const sample of state.reviewSample) {
    const item = state.data.items.find((i) => i.id === sample.id);
    if (item && item.lane === "active" && !item.lastReviewed) {
      item.lastReviewed = today();
    }
  }
  saveDraft();
  $("#review-modal").close();
  persistAndRefresh("本周质检已记入本地。导出 JSON 可把 lastReviewed 一并写回仓库。");
}

function persistAndRefresh(hint) {
  saveDraft();
  renderProgress();
  renderGov();
  renderStats();
  renderList();
  $("#progress-hint").textContent = hint;
}

function exportJson() {
  const blob = new Blob(
    [JSON.stringify(state.data, null, 2) + "\n"],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "items.json";
  a.click();
  URL.revokeObjectURL(url);
}

function resetDraft() {
  if (!confirm("清除本地草稿，并重新加载仓库中的数据？")) return;
  localStorage.removeItem(DRAFT_KEY);
  location.reload();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

boot().catch((err) => {
  console.error(err);
  $("#progress-hint").textContent = "数据加载失败，请检查 data/items.json。";
});
