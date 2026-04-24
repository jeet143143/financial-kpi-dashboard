const svgNs = "http://www.w3.org/2000/svg";

const state = {
  viewMode: "year",
  dateWindow: "36m",
  region: "All Regions",
  category: "All Categories",
  metric: "revenue",
  focusYear: 2026,
  theme: "dark",
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const appData = createDataset();
const years = [...new Set(appData.map((row) => row.year))];
const regions = ["All Regions", ...new Set(appData.map((row) => row.region))];
const categories = ["All Categories", ...new Set(appData.map((row) => row.category))];
const dateWindows = [
  { value: "12m", label: "Last 12 Months" },
  { value: "24m", label: "Last 24 Months" },
  { value: "36m", label: "Last 36 Months" },
  { value: "fy2026", label: "FY2026 Focus" },
];

const formatCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
  notation: "compact",
});

const formatPercent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

const dom = {
  appShell: document.getElementById("appShell"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  themeToggle: document.getElementById("themeToggle"),
  themeLabel: document.querySelector(".theme-toggle__label"),
  heroCards: [...document.querySelectorAll(".kpi-card")],
  trendChart: document.getElementById("trendChart"),
  compareChart: document.getElementById("compareChart"),
  regionChart: document.getElementById("regionChart"),
  categoryChart: document.getElementById("categoryChart"),
  insightsList: document.getElementById("insightsList"),
  regionFilter: document.getElementById("regionFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  metricFilter: document.getElementById("metricFilter"),
  dateWindow: document.getElementById("dateWindow"),
  yearPills: document.getElementById("yearPills"),
  tooltip: document.getElementById("tooltip"),
  trendTitle: document.getElementById("trendTitle"),
  granularityButtons: [...document.querySelectorAll("[data-view-mode]")],
};

bootstrapControls();
window.addEventListener("resize", renderDashboard);

setTimeout(() => {
  dom.appShell.classList.remove("app-loading");
  document.querySelectorAll(".chart-stage").forEach((stage) => stage.classList.add("is-ready"));
  renderDashboard();
}, 900);

renderDashboard();

function bootstrapControls() {
  populateSelect(dom.regionFilter, regions);
  populateSelect(dom.categoryFilter, categories);
  populateSelect(
    dom.dateWindow,
    dateWindows.map((item) => item.label),
    dateWindows.map((item) => item.value),
  );

  dom.metricFilter.value = state.metric;
  dom.regionFilter.value = state.region;
  dom.categoryFilter.value = state.category;
  dom.dateWindow.value = state.dateWindow;

  dom.regionFilter.addEventListener("change", (event) => {
    state.region = event.target.value;
    renderDashboard();
  });

  dom.categoryFilter.addEventListener("change", (event) => {
    state.category = event.target.value;
    renderDashboard();
  });

  dom.metricFilter.addEventListener("change", (event) => {
    state.metric = event.target.value;
    renderDashboard();
  });

  dom.dateWindow.addEventListener("change", (event) => {
    state.dateWindow = event.target.value;
    if (state.dateWindow === "fy2026") {
      state.focusYear = 2026;
    }
    renderDashboard();
  });

  dom.sidebarToggle.addEventListener("click", () => {
    dom.sidebar.classList.toggle("is-collapsed");
  });

  dom.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.body.classList.toggle("light-mode", state.theme === "light");
    dom.themeLabel.textContent = state.theme === "dark" ? "Light Mode" : "Dark Mode";
    renderDashboard();
  });

  dom.granularityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.viewMode = button.dataset.viewMode;
      renderDashboard();
    });
  });
}

function populateSelect(select, labels, values = labels) {
  select.innerHTML = labels
    .map((label, index) => `<option value="${values[index]}">${label}</option>`)
    .join("");
}

function renderDashboard() {
  syncControls();
  const filtered = getFilteredData();
  const summary = computeSummary(filtered);
  const timeSeries = state.viewMode === "year" ? aggregateByYear(filtered) : aggregateByMonth(filtered, state.focusYear);
  const compareSeries = aggregateCompareSeries(filtered);
  const regionSeries = aggregateByRegion(filtered);
  const categorySeries = aggregateByCategory(filtered);

  renderKpis(summary, filtered);
  renderTrendChart(timeSeries, summary);
  renderCompareChart(compareSeries);
  renderRegionChart(regionSeries);
  renderCategoryChart(categorySeries);
  renderInsights(summary, regionSeries, categorySeries, timeSeries);
  animateChartStages();
}

function syncControls() {
  dom.regionFilter.value = state.region;
  dom.categoryFilter.value = state.category;
  dom.metricFilter.value = state.metric;
  dom.dateWindow.value = state.dateWindow;

  dom.granularityButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewMode === state.viewMode);
  });

  document.querySelectorAll(".chip").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.viewMode === state.viewMode);
  });

  renderYearPills();
  dom.trendTitle.textContent =
    state.viewMode === "year"
      ? "Revenue and Profit Trajectory"
      : `Monthly Drilldown for ${state.focusYear}`;
}

function renderYearPills() {
  dom.yearPills.innerHTML = years
    .map(
      (year) =>
        `<button class="year-pill ${state.focusYear === year ? "is-active" : ""}" data-year="${year}">${year}</button>`,
    )
    .join("");

  dom.yearPills.querySelectorAll("[data-year]").forEach((button) => {
    button.addEventListener("click", () => {
      state.focusYear = Number(button.dataset.year);
      state.viewMode = "month";
      renderDashboard();
    });
  });
}

function getFilteredData() {
  let data = [...appData];

  if (state.region !== "All Regions") {
    data = data.filter((row) => row.region === state.region);
  }

  if (state.category !== "All Categories") {
    data = data.filter((row) => row.category === state.category);
  }

  if (state.viewMode === "month") {
    return data.filter((row) => row.year === state.focusYear);
  }

  const ordered = [...data].sort((a, b) => a.dateKey - b.dateKey);
  let startKey = ordered[0].dateKey;

  if (state.dateWindow === "12m") {
    startKey = ordered[ordered.length - 12].dateKey;
  } else if (state.dateWindow === "24m") {
    startKey = ordered[ordered.length - 24].dateKey;
  } else if (state.dateWindow === "fy2026") {
    startKey = 202601;
  }

  data = data.filter((row) => row.dateKey >= startKey);

  return data;
}

function computeSummary(data) {
  const totalRevenue = sum(data, "revenue");
  const totalProfit = sum(data, "profit");
  const totalCost = sum(data, "cost");
  const margin = totalProfit / totalRevenue || 0;

  const sorted = [...data].sort((a, b) => a.dateKey - b.dateKey);
  const split = Math.floor(sorted.length / 2);
  const previousPeriod = sorted.slice(0, split);
  const currentPeriod = sorted.slice(split);

  const currentRevenue = sum(currentPeriod, "revenue");
  const previousRevenue = sum(previousPeriod, "revenue");
  const currentProfit = sum(currentPeriod, "profit");
  const previousProfit = sum(previousPeriod, "profit");
  const growthRate = previousRevenue ? (currentRevenue - previousRevenue) / previousRevenue : 0;
  const profitDelta = previousProfit ? (currentProfit - previousProfit) / previousProfit : 0;
  const costRatio = totalCost / totalRevenue || 0;

  return {
    totalRevenue,
    totalProfit,
    totalCost,
    margin,
    growthRate,
    profitDelta,
    costRatio,
    forecastRevenue: sum(data.filter((row) => row.isForecast), "revenue"),
  };
}

function aggregateByYear(data) {
  const grouped = years
    .map((year) => {
      const rows = data.filter((row) => row.year === year);
      return {
        label: `${year}`,
        year,
        revenue: sum(rows, "revenue"),
        profit: sum(rows, "profit"),
        margin: sum(rows, "profit") / sum(rows, "revenue") || 0,
        isForecast: rows.some((row) => row.isForecast),
      };
    })
    .filter((row) => row.revenue > 0);

  return grouped;
}

function aggregateByMonth(data, year) {
  return monthLabels.map((label, index) => {
    const rows = data.filter((row) => row.year === year && row.month === index + 1);
    return {
      label,
      month: index + 1,
      revenue: sum(rows, "revenue"),
      profit: sum(rows, "profit"),
      margin: sum(rows, "profit") / sum(rows, "revenue") || 0,
      isForecast: rows.some((row) => row.isForecast),
    };
  });
}

function aggregateCompareSeries(data) {
  const series = state.viewMode === "month" ? aggregateByMonth(data, state.focusYear) : aggregateByYear(data);
  return series.map((row) => ({
    label: row.label,
    revenue: row.revenue,
    cost: row.revenue - row.profit,
    isForecast: row.isForecast,
  }));
}

function aggregateByRegion(data) {
  return [...new Set(appData.map((row) => row.region))]
    .map((region) => {
      const rows = data.filter((row) => row.region === region);
      const revenue = sum(rows, "revenue");
      const profit = sum(rows, "profit");
      return {
        label: region,
        revenue,
        profit,
        margin: profit / revenue || 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

function aggregateByCategory(data) {
  return [...new Set(appData.map((row) => row.category))]
    .map((category) => {
      const rows = data.filter((row) => row.category === category);
      const revenue = sum(rows, "revenue");
      const profit = sum(rows, "profit");
      return {
        label: category,
        revenue,
        profit,
        margin: profit / revenue || 0,
      };
    })
    .sort((a, b) => b.margin - a.margin);
}

function renderKpis(summary, data) {
  const sparkSeries = state.viewMode === "month" ? aggregateByMonth(data, state.focusYear) : aggregateByYear(data);
  const items = [
    {
      key: "revenue",
      label: "Revenue",
      value: formatCurrency.format(summary.totalRevenue),
      delta: summary.growthRate,
      caption: "vs prior comparable period",
      footnote: `${formatCurrency.format(summary.forecastRevenue)} forecast-linked`,
      series: sparkSeries.map((point) => point.revenue),
    },
    {
      key: "profit",
      label: "Profit",
      value: formatCurrency.format(summary.totalProfit),
      delta: summary.profitDelta,
      caption: "incremental profitability gain",
      footnote: `${formatPercent.format(summary.margin)} blended margin`,
      series: sparkSeries.map((point) => point.profit),
    },
    {
      key: "margin",
      label: "Profit Margin",
      value: formatPercent.format(summary.margin),
      delta: summary.margin - 0.26,
      caption: "above strategic floor",
      footnote: `${formatPercent.format(1 - summary.costRatio)} retained after costs`,
      series: sparkSeries.map((point) => point.margin),
    },
    {
      key: "growth",
      label: "Growth Rate",
      value: formatPercent.format(summary.growthRate),
      delta: summary.growthRate,
      caption: "top-line expansion",
      footnote: `${state.region === "All Regions" ? "Global blend" : state.region} selection`,
      series: sparkSeries.map((point, index, rows) => {
        if (index === 0) return 0;
        return rows[index - 1] ? (point.revenue - rows[index - 1].revenue) / rows[index - 1].revenue : 0;
      }),
    },
  ];

  dom.heroCards.forEach((card) => {
    const item = items.find((entry) => entry.key === card.dataset.kpi);
    const deltaClass = item.delta >= 0 ? "positive" : "negative";
    const arrow = item.delta >= 0 ? "↑" : "↓";
    card.innerHTML = `
      <div class="kpi-card__top">
        <div>
          <p class="section-label">${item.label}</p>
          <p class="kpi-card__metric">${item.value}</p>
        </div>
        <svg class="kpi-card__sparkline" viewBox="0 0 88 42" aria-hidden="true">
          <path d="${buildSparkline(item.series, 88, 42)}" fill="none" stroke="${item.delta >= 0 ? "#34d399" : "#fb7185"}" stroke-width="3" stroke-linecap="round"></path>
        </svg>
      </div>
      <div class="kpi-card__footer">
        <div>
          <div class="kpi-card__delta ${deltaClass}">
            <span>${arrow}</span>
            <span>${formatPercent.format(Math.abs(item.delta))}</span>
          </div>
          <p class="kpi-card__caption">${item.caption}</p>
        </div>
        <p class="kpi-card__footnote">${item.footnote}</p>
      </div>
    `;
  });
}

function renderTrendChart(series, summary) {
  const svg = dom.trendChart;
  clearSvg(svg);
  const width = 860;
  const height = 360;
  const padding = { top: 24, right: 24, bottom: 46, left: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const primaryKey = state.metric === "margin" ? "margin" : state.metric;
  const secondaryKey = primaryKey === "margin" ? null : primaryKey === "revenue" ? "profit" : "revenue";
  const maxValue = Math.max(
    ...series.map((row) => {
      const secondaryValue = secondaryKey ? row[secondaryKey] : 0;
      return Math.max(row[primaryKey], secondaryValue);
    }),
  );
  const yMax = primaryKey === "margin" ? Math.max(0.4, maxValue * 1.22) : maxValue * 1.18;

  for (let i = 0; i < 5; i += 1) {
    const y = padding.top + (plotHeight / 4) * i;
    svg.append(
      createSvg("line", {
        x1: padding.left,
        x2: width - padding.right,
        y1: y,
        y2: y,
        class: "grid-line",
      }),
    );
  }

  const xStep = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth;
  const revenuePoints = series.map((row, index) => {
    const value = row[primaryKey];
    return {
      x: padding.left + xStep * index,
      y: padding.top + plotHeight - (value / yMax) * plotHeight,
      value,
      label: row.label,
      isForecast: row.isForecast,
      profit: row.profit,
      revenue: row.revenue,
      margin: row.margin,
    };
  });

  const secondaryPoints = secondaryKey
    ? series.map((row, index) => ({
        x: padding.left + xStep * index,
        y: padding.top + plotHeight - (row[secondaryKey] / yMax) * plotHeight,
        value: row[secondaryKey],
        label: row.label,
        isForecast: row.isForecast,
      }))
    : [];

  const areaPath = `${buildSmoothPath(revenuePoints)} L ${padding.left + plotWidth} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`;
  const defs = createSvg("defs");
  defs.innerHTML = `
    <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.48"></stop>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.02"></stop>
    </linearGradient>
    <linearGradient id="profitLineGradient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee"></stop>
      <stop offset="100%" stop-color="#34d399"></stop>
    </linearGradient>
    <linearGradient id="primaryLineGradient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#60a5fa"></stop>
      <stop offset="100%" stop-color="#22d3ee"></stop>
    </linearGradient>
  `;
  svg.append(defs);

  svg.append(createSvg("path", { d: areaPath, fill: "url(#trendAreaGradient)", class: "trend-area" }));
  svg.append(createSvg("path", { d: buildSmoothPath(revenuePoints), class: "trend-line", stroke: "url(#primaryLineGradient)" }));
  if (secondaryPoints.length) {
    svg.append(
      createSvg("path", {
        d: buildSmoothPath(secondaryPoints),
        class: "trend-line",
        stroke: "url(#profitLineGradient)",
        opacity: 0.72,
      }),
    );
  }

  if (series.some((row) => row.isForecast)) {
    const firstForecastIndex = revenuePoints.findIndex((point) => point.isForecast);
    const forecastSlice =
      firstForecastIndex > 0 ? revenuePoints.slice(firstForecastIndex - 1).filter((point, index) => index === 0 || point.isForecast) : revenuePoints.filter((point) => point.isForecast);
    if (forecastSlice.length > 1) {
      svg.append(
        createSvg("path", {
          d: buildSmoothPath(forecastSlice),
          class: "trend-line forecast-line",
          stroke: "#fbbf24",
          opacity: 0.95,
        }),
      );
    }
  }

  revenuePoints.forEach((point) => {
    const circle = createSvg("circle", {
      cx: point.x,
      cy: point.y,
      r: 6,
      class: "chart-point",
      fill: point.isForecast ? "#fbbf24" : "#e2ecff",
      stroke: "#0ea5e9",
      "stroke-width": 2,
    });

    circle.addEventListener("mouseenter", (event) => {
      const metricValue =
        primaryKey === "margin" ? formatPercent.format(point.margin) : formatCurrency.format(point[primaryKey]);
      showTooltip(event, {
        label: point.label,
        value: metricValue,
        meta: `${formatCurrency.format(point.revenue)} revenue • ${formatCurrency.format(point.profit)} profit`,
      });
    });
    circle.addEventListener("mousemove", moveTooltip);
    circle.addEventListener("mouseleave", hideTooltip);
    circle.addEventListener("click", () => {
      if (state.viewMode === "year" && point.label) {
        state.focusYear = Number(point.label);
        state.viewMode = "month";
        renderDashboard();
      }
    });
    svg.append(circle);
  });

  series.forEach((row, index) => {
    const x = padding.left + xStep * index;
    svg.append(
      createSvg("text", {
        x,
        y: height - 18,
        "text-anchor": "middle",
        class: "axis-tick",
      }, row.label),
    );
  });

  for (let i = 0; i < 5; i += 1) {
    const value = (yMax / 4) * (4 - i);
    const label = primaryKey === "margin" ? formatPercent.format(value) : formatCurrency.format(value);
    svg.append(
      createSvg("text", {
        x: 12,
        y: padding.top + (plotHeight / 4) * i + 4,
        class: "axis-tick",
      }, label),
    );
  }

  svg.append(
    createSvg("text", {
      x: width - padding.right - 4,
      y: 24,
      "text-anchor": "end",
      class: "annotation",
      fill: "#fbbf24",
    }, `Forecast overlay: ${formatCurrency.format(summary.forecastRevenue)}`),
  );
}

function renderCompareChart(series) {
  const svg = dom.compareChart;
  clearSvg(svg);
  const width = 420;
  const height = 300;
  const padding = { top: 24, right: 14, bottom: 42, left: 24 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...series.map((row) => Math.max(row.revenue, row.cost))) * 1.14;
  const band = plotWidth / series.length;

  for (let i = 0; i < 4; i += 1) {
    const y = padding.top + (plotHeight / 3) * i;
    svg.append(createSvg("line", { x1: padding.left, x2: width - padding.right, y1: y, y2: y, class: "grid-line" }));
  }

  series.forEach((row, index) => {
    const x = padding.left + index * band + band * 0.12;
    const barWidth = band * 0.28;
    const revenueHeight = (row.revenue / maxValue) * plotHeight;
    const costHeight = (row.cost / maxValue) * plotHeight;

    const revenueBar = createSvg("rect", {
      x,
      y: padding.top + plotHeight - revenueHeight,
      width: barWidth,
      height: revenueHeight,
      rx: 10,
      class: "compare-bar",
      fill: "rgba(56, 189, 248, 0.88)",
    });
    const costBar = createSvg("rect", {
      x: x + barWidth + 8,
      y: padding.top + plotHeight - costHeight,
      width: barWidth,
      height: costHeight,
      rx: 10,
      class: "compare-bar",
      fill: "rgba(248, 113, 113, 0.78)",
    });

    [revenueBar, costBar].forEach((bar, barIndex) => {
      bar.addEventListener("mouseenter", (event) =>
        showTooltip(event, {
          label: `${row.label} ${barIndex === 0 ? "Revenue" : "Cost"}`,
          value: formatCurrency.format(barIndex === 0 ? row.revenue : row.cost),
          meta: row.isForecast ? "Includes forecast assumptions" : "Actual realized value",
        }),
      );
      bar.addEventListener("mousemove", moveTooltip);
      bar.addEventListener("mouseleave", hideTooltip);
      svg.append(bar);
    });

    svg.append(createSvg("text", { x: x + barWidth, y: height - 14, "text-anchor": "middle", class: "axis-tick" }, row.label));
  });
}

function renderRegionChart(series) {
  const svg = dom.regionChart;
  clearSvg(svg);
  const width = 420;
  const height = 300;
  const padding = { top: 24, right: 18, bottom: 24, left: 118 };
  const maxValue = Math.max(...series.map((row) => row.profit)) * 1.16;
  const band = (height - padding.top - padding.bottom) / series.length;

  series.forEach((row, index) => {
    const y = padding.top + band * index + 6;
    const barWidth = ((width - padding.left - padding.right) * row.profit) / maxValue;
    svg.append(createSvg("text", { x: 12, y: y + band * 0.45, class: "axis-tick" }, row.label));
    const track = createSvg("rect", {
      x: padding.left,
      y,
      width: width - padding.left - padding.right,
      height: band * 0.56,
      rx: 12,
      fill: "rgba(148, 163, 184, 0.12)",
    });
    const bar = createSvg("rect", {
      x: padding.left,
      y,
      width: barWidth,
      height: band * 0.56,
      rx: 12,
      class: "region-bar",
      fill: "url(#regionGradient)",
    });

    bar.addEventListener("mouseenter", (event) =>
      showTooltip(event, {
        label: row.label,
        value: formatCurrency.format(row.profit),
        meta: `${formatPercent.format(row.margin)} margin • ${formatCurrency.format(row.revenue)} revenue`,
      }),
    );
    bar.addEventListener("mousemove", moveTooltip);
    bar.addEventListener("mouseleave", hideTooltip);

    svg.append(track);
    svg.append(bar);
    svg.append(
      createSvg("text", { x: padding.left + barWidth + 10, y: y + band * 0.38, class: "axis-tick" }, formatCurrency.format(row.profit)),
    );
  });

  const defs = createSvg("defs");
  defs.innerHTML = `
    <linearGradient id="regionGradient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38bdf8"></stop>
      <stop offset="100%" stop-color="#34d399"></stop>
    </linearGradient>
  `;
  svg.prepend(defs);
}

function renderCategoryChart(series) {
  const svg = dom.categoryChart;
  clearSvg(svg);
  const width = 420;
  const height = 300;
  const cx = 120;
  const cy = 150;
  const radius = 82;
  const strokeWidth = 26;
  const total = series.reduce((sumValue, row) => sumValue + row.revenue, 0);
  let startAngle = -Math.PI / 2;
  const colors = ["#38bdf8", "#34d399", "#fbbf24", "#a78bfa"];

  series.forEach((row, index) => {
    const slice = (row.revenue / total) * Math.PI * 2;
    const endAngle = startAngle + slice;
    const path = describeArc(cx, cy, radius, startAngle, endAngle);
    const segment = createSvg("path", {
      d: path,
      fill: "none",
      stroke: colors[index % colors.length],
      "stroke-width": strokeWidth,
      "stroke-linecap": "round",
      class: "segment",
    });

    segment.addEventListener("mouseenter", (event) =>
      showTooltip(event, {
        label: row.label,
        value: formatPercent.format(row.revenue / total),
        meta: `${formatPercent.format(row.margin)} margin • ${formatCurrency.format(row.revenue)} revenue`,
      }),
    );
    segment.addEventListener("mousemove", moveTooltip);
    segment.addEventListener("mouseleave", hideTooltip);

    svg.append(segment);
    startAngle = endAngle + 0.035;
  });

  svg.append(createSvg("circle", { cx, cy, r: 48, fill: "var(--bg-muted)" }));
  svg.append(createSvg("text", { x: cx, y: cy - 4, "text-anchor": "middle", class: "axis-label" }, "Avg Margin"));
  svg.append(
    createSvg(
      "text",
      {
        x: cx,
        y: cy + 24,
        "text-anchor": "middle",
        fill: "var(--text)",
        style: "font-size: 28px; font-weight: 700;",
      },
      formatPercent.format(series.reduce((sumValue, row) => sumValue + row.margin, 0) / series.length || 0),
    ),
  );

  series.forEach((row, index) => {
    const y = 56 + index * 52;
    svg.append(createSvg("circle", { cx: 252, cy: y, r: 6, fill: colors[index % colors.length] }));
    svg.append(createSvg("text", { x: 268, y: y + 4, class: "axis-tick" }, row.label));
    svg.append(
      createSvg("text", { x: 390, y: y + 4, "text-anchor": "end", class: "axis-tick" }, formatPercent.format(row.margin)),
    );
  });
}

function renderInsights(summary, regionSeries, categorySeries, timeSeries) {
  const bestRegion = regionSeries[0];
  const weakestRegion = regionSeries[regionSeries.length - 1];
  const bestCategory = categorySeries[0];
  const peakPoint = [...timeSeries].sort((a, b) => b.revenue - a.revenue)[0];
  const forecastShare = summary.forecastRevenue / summary.totalRevenue || 0;

  const insights = [
    {
      tag: "Growth Driver",
      text: `${bestRegion.label} leads profitability with ${formatCurrency.format(bestRegion.profit)} in profit and ${formatPercent.format(bestRegion.margin)} margin, making it the clearest engine for near-term expansion.`,
    },
    {
      tag: "Portfolio Signal",
      text: `${bestCategory.label} is the highest-quality category at ${formatPercent.format(bestCategory.margin)} margin, supporting a premium mix strategy for executive planning.`,
    },
    {
      tag: "Timing",
      text: `${peakPoint.label} is the strongest point in the current view, with ${formatCurrency.format(peakPoint.revenue)} in revenue. This is the best anchor for a year-to-date storyline in presentations.`,
    },
    {
      tag: "Risk Watch",
      text: `${weakestRegion.label} trails the peer set, and ${formatPercent.format(forecastShare)} of current revenue is forecast-linked. This suggests monitoring conversion quality before locking the next operating plan.`,
    },
  ];

  dom.insightsList.innerHTML = insights
    .map(
      (insight) => `
        <article class="insight-card">
          <span class="insight-card__tag">${insight.tag}</span>
          <p>${insight.text}</p>
        </article>
      `,
    )
    .join("");
}

function createDataset() {
  const regionsBase = {
    "North America": 1.2,
    Europe: 1.02,
    APAC: 1.14,
    LATAM: 0.82,
  };

  const categoryBase = {
    Enterprise: 1.24,
    SMB: 0.92,
    Consumer: 0.78,
    "Public Sector": 1.05,
  };

  const monthSeasonality = [0.92, 0.96, 0.99, 1.02, 1.06, 1.08, 1.04, 1.07, 1.12, 1.18, 1.26, 1.34];
  const dataset = [];

  for (let year = 2024; year <= 2026; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      Object.entries(regionsBase).forEach(([region, regionMultiplier], regionIndex) => {
        Object.entries(categoryBase).forEach(([category, categoryMultiplier], categoryIndex) => {
          const growthTrend = 1 + (year - 2024) * 0.12 + month * 0.006;
          const forecastLift = year === 2026 && month >= 7 ? 1.08 : 1;
          const signal = 1 + Math.sin((month + regionIndex + categoryIndex) * 1.2) * 0.035;
          const revenue =
            1600000 *
            regionMultiplier *
            categoryMultiplier *
            monthSeasonality[month - 1] *
            growthTrend *
            forecastLift *
            signal;
          const marginBase = 0.24 + regionIndex * 0.015 + categoryIndex * 0.01 + (month > 8 ? 0.02 : 0);
          const margin = Math.min(0.42, marginBase + (year - 2024) * 0.014 + (month % 3 === 0 ? 0.01 : 0));
          const profit = revenue * margin;
          const cost = revenue - profit;

          dataset.push({
            year,
            month,
            dateKey: year * 100 + month,
            label: `${monthLabels[month - 1]} ${year}`,
            region,
            category,
            revenue,
            profit,
            cost,
            isForecast: year === 2026 && month >= 7,
          });
        });
      });
    }
  }

  return dataset;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function buildSparkline(series, width, height) {
  const minValue = Math.min(...series);
  const maxValue = Math.max(...series);
  const step = series.length > 1 ? width / (series.length - 1) : width;

  return series
    .map((value, index) => {
      const x = index * step;
      const y =
        maxValue === minValue ? height / 2 : height - ((value - minValue) / (maxValue - minValue)) * (height - 6) - 3;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildSmoothPath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
}

function polarToCartesian(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function createSvg(tag, attrs = {}, textContent = "") {
  const node = document.createElementNS(svgNs, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  if (textContent) {
    node.textContent = textContent;
  }
  return node;
}

function clearSvg(svg) {
  svg.innerHTML = "";
}

function showTooltip(event, data) {
  dom.tooltip.innerHTML = `
    <div class="tooltip__label">${data.label}</div>
    <div class="tooltip__value">${data.value}</div>
    <div class="tooltip__meta">${data.meta}</div>
  `;
  dom.tooltip.classList.add("is-visible");
  moveTooltip(event);
}

function moveTooltip(event) {
  dom.tooltip.style.left = `${event.clientX + 18}px`;
  dom.tooltip.style.top = `${event.clientY + 18}px`;
}

function hideTooltip() {
  dom.tooltip.classList.remove("is-visible");
}

function animateChartStages() {
  if (dom.appShell.classList.contains("app-loading")) {
    return;
  }

  document.querySelectorAll(".chart-stage").forEach((stage) => {
    stage.classList.add("is-refreshing");
    stage.classList.remove("is-ready");
  });

  requestAnimationFrame(() => {
    document.querySelectorAll(".chart-stage").forEach((stage) => {
      stage.classList.remove("is-refreshing");
      stage.classList.add("is-ready");
    });
  });
}
