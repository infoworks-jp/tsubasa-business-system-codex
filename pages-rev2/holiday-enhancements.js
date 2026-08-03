// Final direct deployment trigger: 2026-08-03T19:25+09:00
(function () {
  "use strict";

  const HOLIDAYS = Object.freeze({
    "2026-01-01": "元日",
    "2026-01-12": "成人の日",
    "2026-02-11": "建国記念の日",
    "2026-02-23": "天皇誕生日",
    "2026-03-20": "春分の日",
    "2026-04-29": "昭和の日",
    "2026-05-03": "憲法記念日",
    "2026-05-04": "みどりの日",
    "2026-05-05": "こどもの日",
    "2026-05-06": "振替休日",
    "2026-07-20": "海の日",
    "2026-08-11": "山の日",
    "2026-09-21": "敬老の日",
    "2026-09-22": "国民の休日",
    "2026-09-23": "秋分の日",
    "2026-10-12": "スポーツの日",
    "2026-11-03": "文化の日",
    "2026-11-23": "勤労感謝の日",
    "2027-01-01": "元日",
    "2027-01-11": "成人の日",
    "2027-02-11": "建国記念の日",
    "2027-02-23": "天皇誕生日",
    "2027-03-21": "春分の日",
    "2027-03-22": "振替休日",
    "2027-04-29": "昭和の日",
    "2027-05-03": "憲法記念日",
    "2027-05-04": "みどりの日",
    "2027-05-05": "こどもの日",
    "2027-07-19": "海の日",
    "2027-08-11": "山の日",
    "2027-09-20": "敬老の日",
    "2027-09-23": "秋分の日",
    "2027-10-11": "スポーツの日",
    "2027-11-03": "文化の日",
    "2027-11-23": "勤労感謝の日"
  });

  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

  function dateInfo(value) {
    const dateText = String(value || "").slice(0, 10);
    const date = new Date(`${dateText}T00:00:00+09:00`);
    if (Number.isNaN(date.getTime())) return { dateText, weekday: "", holiday: "" };
    return {
      dateText,
      weekday: WEEKDAYS[date.getDay()],
      holiday: HOLIDAYS[dateText] || ""
    };
  }

  function dayType(value) {
    const info = dateInfo(value);
    if (info.holiday) return "祝日";
    if (info.weekday === "土" || info.weekday === "日") return "週末";
    return "平日";
  }

  function compactDate(value, includeYear) {
    const info = dateInfo(value);
    if (!info.dateText) return "";
    const base = includeYear
      ? info.dateText.slice(2).replaceAll("-", "/")
      : info.dateText.slice(5).replace("-", "/");
    return `${base}(${info.weekday}${info.holiday ? `・${info.holiday}` : ""})`;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function install() {
    if (typeof window.dayLabel === "function" && !window.dayLabel.__holidayEnhanced) {
      const enhancedDayLabel = function enhancedDayLabel(value) {
        return compactDate(value, false);
      };
      enhancedDayLabel.__holidayEnhanced = true;
      window.dayLabel = enhancedDayLabel;
    }

    if (typeof window.renderDaily === "function" && !window.renderDaily.__holidayEnhanced) {
      const enhancedRenderDaily = function enhancedRenderDaily() {
        const rows = state.daily.map((row) => {
          const info = dateInfo(row.business_date);
          const status = row.total_sales > 0
            ? "営業"
            : (/休業|休日|定休/.test(row.notes || "") ? "休業" : "入力待ち");
          return [
            info.dateText,
            info.weekday,
            dayType(info.dateText),
            info.holiday || "",
            status,
            yen(row.total_sales),
            row.customers,
            yen(row.avg_spend),
            row.issued_count,
            row.net_count,
            yen(row.lunch_sales),
            yen(row.evening_sales),
            yen(row.late_sales),
            row.notes || ""
          ];
        });
        $("host").innerHTML = `<div class="panel">${table(
          ["日付", "曜", "日区分", "祝日名", "状態", "売上", "客数", "客単価", "発行数", "正味出数", "昼", "夜", "深夜", "備考"],
          rows,
          true
        )}</div>`;
      };
      enhancedRenderDaily.__holidayEnhanced = true;
      window.renderDaily = enhancedRenderDaily;
    }

    if (typeof window.renderWeekday === "function" && !window.renderWeekday.__holidayEnhanced) {
      const enhancedRenderWeekday = function enhancedRenderWeekday() {
        const weekdayMap = {};
        state.daily.filter((row) => row.total_sales > 0).forEach((row) => {
          const weekday = dateInfo(row.business_date).weekday;
          weekdayMap[weekday] = weekdayMap[weekday] || { days: 0, sales: 0, customers: 0 };
          weekdayMap[weekday].days += 1;
          weekdayMap[weekday].sales += row.total_sales;
          weekdayMap[weekday].customers += row.customers;
        });
        const order = ["月", "火", "水", "木", "金", "土", "日"];
        const rows = order.map((weekday) => {
          const value = weekdayMap[weekday] || { days: 0, sales: 0, customers: 0 };
          return { label: weekday, value: value.days ? value.sales / value.days : 0, ...value };
        });
        const total = rows.reduce((sum, row) => sum + row.sales, 0);
        const typeMap = {};
        state.daily.filter((row) => row.total_sales > 0).forEach((row) => {
          const type = dayType(row.business_date);
          typeMap[type] = typeMap[type] || { days: 0, sales: 0, customers: 0 };
          typeMap[type].days += 1;
          typeMap[type].sales += row.total_sales;
          typeMap[type].customers += row.customers;
        });
        const typeRows = ["平日", "週末", "祝日"].map((type) => {
          const value = typeMap[type] || { days: 0, sales: 0, customers: 0 };
          return [
            type,
            value.days + "日",
            yen(value.sales),
            pct(total ? value.sales / total : 0),
            yen(value.days ? value.sales / value.days : 0),
            value.customers + "人",
            yen(value.customers ? value.sales / value.customers : 0)
          ];
        });
        $("host").innerHTML = `<div class="grid2"><div class="panel chart"><h3>${scopeLabel()} 曜日別 平均売上</h3>${graphMeta("円・%", "棒の上＝平均売上／下段＝曜日別売上構成比")}${barSvg(rows, "label", "value", { total: rows.reduce((sum, row) => sum + row.value, 0) })}</div><div class="panel"><h3>曜日別実績</h3>${table(["曜日", "営業日", "売上", "売上構成比", "平均売上", "客数", "客単価"], rows.map((row) => [row.label, row.days + "日", yen(row.sales), pct(total ? row.sales / total : 0), yen(row.value), row.customers + "人", yen(row.customers ? row.sales / row.customers : 0)]))}</div></div><div class="panel" style="margin-top:12px"><h3>平日・週末・祝日別実績</h3>${table(["日区分", "営業日", "売上", "売上構成比", "平均売上", "客数", "客単価"], typeRows, true)}</div>`;
      };
      enhancedRenderWeekday.__holidayEnhanced = true;
      window.renderWeekday = enhancedRenderWeekday;
    }

    if (typeof window.lineSvg === "function" && !window.lineSvg.__holidayEnhanced) {
      const originalLineSvg = window.lineSvg;
      const enhancedLineSvg = function enhancedLineSvg(rows) {
        let svg = originalLineSvg(rows);
        for (const row of rows || []) {
          const dateText = String(row.business_date || "").slice(0, 10);
          if (!dateText) continue;
          const oldMonth = dateText.slice(5).replace("-", "/");
          const oldAll = dateText.slice(2).replaceAll("-", "/");
          const newMonth = compactDate(dateText, false);
          const newAll = compactDate(dateText, true);
          svg = svg.replace(new RegExp(`>${escapeRegExp(oldAll)}<`, "g"), `>${newAll}<`);
          svg = svg.replace(new RegExp(`>${escapeRegExp(oldMonth)}<`, "g"), `>${newMonth}<`);
        }
        return svg;
      };
      enhancedLineSvg.__holidayEnhanced = true;
      window.lineSvg = enhancedLineSvg;
    }

    const style = document.createElement("style");
    style.textContent = `
      .holiday-note{font-size:12px;color:#b91c1c;margin-top:6px}
      @media(max-width:700px){.chart svg text{font-size:10px}}
    `;
    document.head.appendChild(style);

    const toolbar = document.querySelector(".toolbar");
    if (toolbar && !document.getElementById("holidayLegend")) {
      const note = document.createElement("span");
      note.id = "holidayLegend";
      note.className = "holiday-note";
      note.textContent = "日付は曜日付き。祝日は祝日名を表示（日本の国民の祝日）";
      toolbar.appendChild(note);
    }

    if (typeof window.reloadCurrent === "function") {
      window.reloadCurrent();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
