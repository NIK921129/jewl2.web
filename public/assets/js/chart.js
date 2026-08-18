/* =========================================================
   NOVA ADMIN — Simple SVG Charting Utility
   ========================================================= */
function renderChart(container, data, { key = "value", label = "Label", color = "var(--brand)" } = {}) {
  if (!data || !data.length) {
    container.innerHTML = '<div class="empty">No data to display.</div>';
    return;
  }
  const max = Math.max(1, ...data.map(d => d[key]));
  const points = data.map((d, i) => `${i * (100 / (data.length - 1))},${100 - (d[key] / max) * 95}`).join(" ");

  container.innerHTML = `
    <div class="chart-container">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.3" />
            <stop offset="100%" stop-color="${color}" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polyline fill="url(#chart-gradient)" stroke="${color}" stroke-width="0.5" points="0,100 ${points} 100,100" />
      </svg>
      <div class="chart-tooltips">
        ${data.map((d, i) => `
          <div class="chart-tooltip" style="left: ${i * (100 / (data.length - 1))}%">
            <div class="chart-tooltip-line"></div>
            <div class="chart-tooltip-label">
              <b>${d[key]} ${label}</b>
              <span>${d.date}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;color:var(--muted);font-size:11px;margin-top:8px">
      <span>${data[0].date}</span>
      <span>${data.at(-1).date}</span>
    </div>
  `;
}