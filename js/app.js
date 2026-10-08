const DRAFT_KEY = "plan100.draft.v1";
const STATUS_LABEL = {
  idea: "念头",
  planned: "打算做",
  doing: "进行中",
  done: "已完成",
};

const state = {
  data: null,
  category: "all",
  status: "all",
  editingId: null,
};

const $ = (sel) => document.querySelector(sel);

async function boot() {
  const base = await loadBaseData();
  const draft = loadDraft();
  state.data = draft ? mergeDraft(base, draft) : structuredClone(base);
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
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  state.data.meta.updated = payload.updated;
}

function mergeDraft(base, draft) {
  const next = structuredClone(base);
  if (Array.isArray(draft.items)) next.items = draft.items;
  if (draft.updated) next.meta.updated = draft.updated;
  return next;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function bindEvents() {
  $("#status-filter").addEventListener("change", (e) => {
    state.status = e.target.value;
    renderList();
  });

  $("#btn-add").addEventListener("click", () => openModal());
  $("#btn-export").addEventListener("click", exportJson);
  $("#btn-reset-draft").addEventListener("click", resetDraft);

  $("#item-form").addEventListener("submit", (e) => {
    const submitter = e.submitter;
    if (submitter?.value === "cancel") {
      state.editingId = null;
      return;
    }
    if (submitter?.value === "save") {
      e.preventDefault();
      saveFromForm();
      $("#item-modal").close();
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
  renderStats();
  renderList();
}

function renderFilters(categories) {
  const root = $("#filters");
  const chips = [
    { id: "all", name: "全部" },
    ...categories,
  ];
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
  const current = items.length;
  const goal = meta.goal || 100;
  $("#count-current").textContent = String(current);

  const circumference = 2 * Math.PI * 52;
  const ratio = Math.min(current / goal, 1);
  $("#ring-fill").style.strokeDashoffset = String(circumference * (1 - ratio));

  if (!localStorage.getItem(DRAFT_KEY)) {
    if (current === 0) {
      $("#progress-hint").textContent = "从今天的一个念头开始。";
    } else if (current < goal) {
      $("#progress-hint").textContent = `还差 ${goal - current} 件。不必一次凑齐。`;
    } else {
      $("#progress-hint").textContent = "一百件已满。可以开始做，也可以继续追加。";
    }
  }
}

function renderStats() {
  const { categories, items } = state.data;
  const root = $("#stats");
  root.innerHTML = categories
    .map((c) => {
      const n = items.filter((i) => i.category === c.id).length;
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
    .slice()
    .sort((a, b) => b.id - a.id);
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
      return `
        <li class="item" style="animation-delay:${delay}ms" data-id="${item.id}">
          <div class="item-index">${String(item.id).padStart(2, "0")}</div>
          <div class="item-body">
            <h3>${escapeHtml(item.title)}</h3>
            <div class="item-meta">
              <span class="tag" style="color:${cat.color}">
                <span class="tag-dot"></span>${escapeHtml(cat.name)}
              </span>
              <span class="tag">${STATUS_LABEL[item.status] || item.status}</span>
              ${item.source ? `<span class="tag">${escapeHtml(item.source)}</span>` : ""}
            </div>
            ${item.note ? `<p class="item-note">${escapeHtml(item.note)}</p>` : ""}
          </div>
          <div class="item-side">
            <span class="item-date">${escapeHtml(item.added || "")}</span>
            <div class="item-actions">
              <button type="button" data-action="edit">编辑</button>
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
    });
  });
}

function openModal(id) {
  state.editingId = id ?? null;
  const modal = $("#item-modal");
  $("#modal-title").textContent = id ? "编辑条目" : "记下一条";

  if (id) {
    const item = state.data.items.find((i) => i.id === id);
    if (!item) return;
    $("#field-title").value = item.title;
    $("#field-category").value = item.category;
    $("#field-status").value = item.status;
    $("#field-source").value = item.source || "";
    $("#field-note").value = item.note || "";
  } else {
    $("#item-form").reset();
    $("#field-status").value = "idea";
  }

  modal.showModal();
  $("#field-title").focus();
}

function saveFromForm() {
  const title = $("#field-title").value.trim();
  if (!title) return;

  const payload = {
    title,
    category: $("#field-category").value,
    status: $("#field-status").value,
    source: $("#field-source").value.trim(),
    note: $("#field-note").value.trim(),
  };

  if (state.editingId) {
    const item = state.data.items.find((i) => i.id === state.editingId);
    Object.assign(item, payload);
  } else {
    const nextId =
      state.data.items.reduce((max, i) => Math.max(max, i.id), 0) + 1;
    state.data.items.push({
      id: nextId,
      ...payload,
      added: today(),
    });
  }

  state.editingId = null;
  saveDraft();
  renderProgress();
  renderStats();
  renderList();
  $("#progress-hint").textContent = "已写入本地草稿。导出 JSON 后提交到仓库即可上线。";
}

function removeItem(id) {
  if (!confirm("确定删除这条吗？删除会写入本地草稿。")) return;
  state.data.items = state.data.items.filter((i) => i.id !== id);
  saveDraft();
  renderProgress();
  renderStats();
  renderList();
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
