import { loadCharter, renderCharter } from "./charter.js";

const LANE_LABEL = {
  draft: "草稿",
  active: "活跃",
  dormant: "休眠",
  archived: "归档",
};

const $ = (sel) => document.querySelector(sel);

async function boot() {
  const res = await fetch("data/pipelines.json", { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载 data/pipelines.json");
  const data = await res.json();
  try {
    const charter = await loadCharter();
    if (charter.northStar) $("#north-star").textContent = charter.northStar;
    renderCharter(charter, $("#charter"));
  } catch (err) {
    console.error(err);
  }
  render(data);
}

function render(data) {
  const { meta, pipelines } = data;
  const slots = meta.governance?.activeSlots ?? 8;
  const active = pipelines.filter((p) => p.lane === "active");
  const dormant = pipelines.filter((p) => p.lane === "dormant").length;
  const archived = pipelines.filter((p) => p.lane === "archived").length;

  $("#site-subtitle").textContent = meta.subtitle;
  $("#count-current").textContent = String(active.length);
  $("#count-goal").textContent = String(slots);

  const circumference = 2 * Math.PI * 52;
  const ratio = Math.min(active.length / slots, 1);
  $("#ring-fill").style.strokeDashoffset = String(circumference * (1 - ratio));
  $("#progress-hint").textContent =
    active.length >= slots
      ? "活跃槽已满。新流水线请先挤掉一条，或落草稿。"
      : `还可激活 ${slots - active.length} 条。原则写进 registry，步骤写进 playbook。`;

  $("#gov-metrics").innerHTML = `
    <div class="gov-chip ${active.length >= slots ? "warn" : ""}">
      <span class="k">活跃槽</span>
      <span class="v">${active.length}/${slots}</span>
    </div>
    <div class="gov-chip">
      <span class="k">休眠</span>
      <span class="v">${dormant}</span>
    </div>
    <div class="gov-chip">
      <span class="k">归档</span>
      <span class="v">${archived}</span>
    </div>
    <div class="gov-chip">
      <span class="k">TTL</span>
      <span class="v">${meta.governance?.ttlDays ?? 90}天</span>
    </div>
  `;

  const list = $("#pipeline-list");
  $("#empty-state").hidden = pipelines.length > 0;
  list.innerHTML = pipelines
    .slice()
    .sort((a, b) => {
      const rank = { active: 0, draft: 1, dormant: 2, archived: 3 };
      return (rank[a.lane] ?? 9) - (rank[b.lane] ?? 9);
    })
    .map((p, idx) => {
      const principles = (p.principles || [])
        .map((line, i) => `<li>${i + 1}. ${escapeHtml(line)}</li>`)
        .join("");
      return `
        <li class="item lane-${p.lane}" style="animation-delay:${idx * 40}ms">
          <div class="item-index">${String(idx + 1).padStart(2, "0")}</div>
          <div class="item-body">
            <h3>${escapeHtml(p.title)}</h3>
            <div class="item-meta">
              <span class="tag">${LANE_LABEL[p.lane] || p.lane}</span>
              <span class="tag">${escapeHtml(p.id)}</span>
              ${p.playbook ? `<span class="tag">有说明</span>` : ""}
            </div>
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
