/** Shared charter strip for Plan 100 pages. */
export async function loadCharter() {
  const res = await fetch("data/charter.json", { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载 data/charter.json");
  return res.json();
}

export function renderCharter(charter, root) {
  if (!root || !charter) return;
  const f = charter.layers?.foundation;
  const b = charter.layers?.base;
  const p = charter.layers?.peak;
  root.innerHTML = `
    <p class="charter-north"><span class="charter-k">山顶</span>${escapeHtml(charter.northStar)}</p>
    <ul class="charter-layers">
      <li><span class="charter-k">${escapeHtml(f?.name || "底层原则")}</span>${escapeHtml(f?.text || "")}</li>
      <li><span class="charter-k">${escapeHtml(b?.name || "山底原则")}</span>${escapeHtml(b?.text || "")}</li>
      <li><span class="charter-k">${escapeHtml(p?.name || "山顶原则")}</span>${escapeHtml(p?.text || "")}</li>
    </ul>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
