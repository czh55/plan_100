import { loadCharter, renderCharter } from "./charter.js";

const LANE_LABEL = {
  draft: "草稿",
  active: "活跃",
  dormant: "休眠",
  archived: "归档",
};

const ORIGIN_FALLBACK = {
  self: "自己定义",
  borrowed: "拿来主义",
};

const state = {
  data: null,
  origin: "all",
};

const $ = (sel) => document.querySelector(sel);

async function boot() {
  const res = await fetch("data/pipelines.json", { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载 data/pipelines.json");
  state.data = await res.json();
  try {
    const charter = await loadCharter();
    if (charter.northStar) $("#north-star").textContent = charter.northStar;
    renderCharter(charter, $("#charter"));
  } catch (err) {
    console.error(err);
  }
  renderAll();
}

function originLabel(id) {
  const map = state.data.meta.origins || ORIGIN_FALLBACK;
  return map[id] || ORIGIN_FALLBACK[id] || id || "未标注";
}

function originOf(p) {
  return p.origin === "borrowed" ? "borrowed" : "self";
}

function renderAll() {
  renderMetrics();
  renderOriginFilters();
  renderList();
}

function renderMetrics() {
  const { meta, pipelines } = state.data;
  const slots = meta.governance?.activeSlots ?? 8;
  const active = pipelines.filter((p) => p.lane === "active");
  const selfN = pipelines.filter((p) => originOf(p) === "self").length;
  const borrowedN = pipelines.filter((p) => originOf(p) === "borrowed").length;
  const dormant = pipelines.filter((p) => p.lane === "dormant").length;

  $("#site-subtitle").textContent = meta.subtitle;
  $("#count-current").textContent = String(active.length);
  $("#count-goal").textContent = String(slots);

  const circumference = 2 * Math.PI * 52;
  const ratio = Math.min(active.length / slots, 1);
  $("#ring-fill").style.strokeDashoffset = String(circumference * (1 - ratio));
  $("#progress-hint").textContent =
    active.length >= slots
      ? "活跃槽已满。新流水线请先挤掉一条，或落草稿。"
      : `还可激活 ${slots - active.length} 条。登记时标明：自己定义 / 拿来主义。`;

  $("#gov-metrics").innerHTML = `
    <div class="gov-chip ${active.length >= slots ? "warn" : ""}">
      <span class="k">活跃槽</span>
      <span class="v">${active.length}/${slots}</span>
    </div>
    <div class="gov-chip">
      <span class="k">自己定义</span>
      <span class="v">${selfN}</span>
    </div>
    <div class="gov-chip">
      <span class="k">拿来主义</span>
      <span class="v">${borrowedN}</span>
    </div>
    <div class="gov-chip">
      <span class="k">休眠</span>
      <span class="v">${dormant}</span>
    </div>
  `;
}

function renderOriginFilters() {
  const root = $("#origin-filters");
  const chips = [
    { id: "all", name: "全部来源" },
    { id: "self", name: originLabel("self") },
    { id: "borrowed", name: originLabel("borrowed") },
  ];
  root.innerHTML = chips
    .map(
      (c) => `
      <button type="button" class="filter-chip" role="tab"
        data-origin="${c.id}"
        aria-selected="${state.origin === c.id}">
        ${c.name}
      </button>`
    )
    .join("");

  root.querySelectorAll(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.origin = btn.dataset.origin;
      root.querySelectorAll(".filter-chip").forEach((b) => {
        b.setAttribute("aria-selected", String(b === btn));
      });
      renderList();
    });
  });
}

function filteredPipelines() {
  return state.data.pipelines
    .filter((p) => state.origin === "all" || originOf(p) === state.origin)
    .slice()
    .sort((a, b) => {
      const rank = { active: 0, draft: 1, dormant: 2, archived: 3 };
      const lr = (rank[a.lane] ?? 9) - (rank[b.lane] ?? 9);
      if (lr !== 0) return lr;
      const or = originOf(a) === "self" ? 0 : 1;
      const obr = originOf(b) === "self" ? 0 : 1;
      return or - obr;
    });
}

function renderList() {
  const list = $("#pipeline-list");
  const pipelines = filteredPipelines();
  $("#empty-state").hidden = pipelines.length > 0;

  list.innerHTML = pipelines
    .map((p, idx) => {
      const origin = originOf(p);
      const principles = (p.principles || [])
        .map((line, i) => `<li>${i + 1}. ${escapeHtml(line)}</li>`)
        .join("");
      return `
        <li class="item lane-${p.lane} origin-${origin}" style="animation-delay:${idx * 40}ms">
          <div class="item-index">${String(idx + 1).padStart(2, "0")}</div>
          <div class="item-body">
            <h3>${escapeHtml(p.title)}</h3>
            <div class="item-meta">
              <span class="tag tag-origin tag-origin-${origin}">${escapeHtml(originLabel(origin))}</span>
              <span class="tag">${LANE_LABEL[p.lane] || p.lane}</span>
              <span class="tag">${escapeHtml(p.id)}</span>
              ${p.playbook ? `<span class="tag">有说明</span>` : ""}
            </div>
            ${
              origin === "borrowed" && p.originNote
                ? `<p class="item-note"><strong>出处：</strong>${escapeHtml(p.originNote)}</p>`
                : ""
            }
            ${
              principles
                ? `<ol class="principle-list">${principles}</ol>`
                : ""
            }
            ${
              p.whyLose
                ? `<p class="item-note"><strong>若丢掉：</strong>${escapeHtml(p.whyLose)}</p>`
                : ""
            }
            ${
              p.signal
                ? `<p class="item-note"><strong>怎样算有价值：</strong>${escapeHtml(p.signal)}</p>`
                : ""
            }
          </div>
          <div class="item-side">
            <span class="item-date">${escapeHtml(p.renewed || p.added || "")}</span>
            <div class="item-actions">
              ${
                p.playbook
                  ? `<a class="btn btn-ghost btn-small" href="${escapeAttr(p.playbook)}">打开说明</a>`
                  : ""
              }
            </div>
          </div>
        </li>`;
    })
    .join("");
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll("'", "&#39;");
}

boot().catch((err) => {
  console.error(err);
  $("#progress-hint").textContent = "数据加载失败，请检查 data/pipelines.json。";
});
