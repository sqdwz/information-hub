export const classificationSource = {
  id: "mnr-land-use",
  version: "2023",
  name: "国土空间调查、规划、用途管制用地用海分类指南",
  reference: "自然资发〔2023〕234号 · 表2.1",
  url: "https://app.www.gov.cn/govdata/gov/202311/28/509752/article.html"
};

export const featuredLandCodes = ["0103", "0201", "0701", "1207", "1704"];

const comparisonCodes = new Map([
  ["0103", ["0101", "0102", "0201"]],
  ["0201", ["0205", "0103", "0301"]]
]);

export function readLandData(entries) {
  const records = entries.map(entry => ({
    ...entry,
    key: [classificationSource.id, classificationSource.version, entry.code].join("/"),
    standardId: classificationSource.id,
    version: classificationSource.version,
    verificationStatus: "classification-review-pending"
  }));
  const byCode = new Map(records.map(record => [record.code, record]));
  if (!records.length || records.length !== byCode.size || records.some(record => {
    if (typeof record.code !== "string" || !/^(?:\d{2}){1,3}$/.test(record.code) || record.code.length !== record.level * 2) return true;
    if (record.level === 1) return record.parent !== null;
    return record.parent !== record.code.slice(0, -2) || !byCode.has(record.parent);
  })) throw new Error("Invalid land classification index");
  return {
    records,
    byCode,
    roots: records.filter(record => record.level === 1),
    related(record) {
      return (comparisonCodes.get(record.code) || []).map(code => byCode.get(code)).filter(Boolean);
    }
  };
}

export function landSceneUrl(record) {
  return new URL(`../library/scenes/${record.code}.webp`, import.meta.url);
}

export function filterLand(records, { query = "", medium = "", level = "", category = "", sort = "featured" } = {}) {
  const term = query.trim().toLocaleLowerCase();
  const codeQuery = /^\d+$/.test(term);
  const exactCode = codeQuery && records.some(record => record.code === term);
  const scored = [];
  for (const record of records) {
    if (medium && record.medium !== medium) continue;
    if (level && String(record.level) !== level) continue;
    if (category && !record.code.startsWith(category)) continue;
    if (exactCode && record.code !== term) continue;
    if (codeQuery && !record.code.startsWith(term)) continue;
    if (term && !codeQuery) {
      const searchable = [record.name, record.summary, record.usage, record.identify].join(" ").toLocaleLowerCase();
      if (!searchable.includes(term)) continue;
    }
    const featured = featuredLandCodes.indexOf(record.code);
    let score = featured === -1 ? featuredLandCodes.length : featured;
    if (term) {
      score = 2;
      if (record.code === term || record.name === term) score = 0;
      else if (record.code.includes(term) || record.name.includes(term)) score = 1;
    }
    scored.push({ record, score });
  }

  return scored.sort((a, b) => {
    if (sort === "name") return a.record.name.localeCompare(b.record.name, "zh-CN") || a.record.code.localeCompare(b.record.code);
    const rank = sort === "featured" ? a.score - b.score : 0;
    return rank || a.record.code.localeCompare(b.record.code);
  }).map(({ record }) => record);
}

export const symbolVariants = [
  { id: "color", label: "彩色示意" },
  { id: "mono", label: "黑白示意" },
  { id: "dense", label: "密度示意" }
];

const teachingSymbols = {
  field: { fillColor: "#dfc26b", strokeColor: "#73541f", pattern: '<path d="M0 12 4 8l4 4 4-4 4 4"/>' },
  trees: { fillColor: "#a7cf83", strokeColor: "#37663d", pattern: '<circle cx="8" cy="8" r="3.5"/>' },
  housing: { fillColor: "#e2a99b", strokeColor: "#983f3e", pattern: '<path d="m-4 4 8-8M0 16 16 0m-4 20 8-8"/>' },
  road: { fillColor: "#aaa8a1", strokeColor: "#4d4943", pattern: '<path d="M2 8h10" stroke-dasharray="5 2"/>' },
  water: { fillColor: "#9accdd", strokeColor: "#27667c", pattern: '<path d="M0 8q4-4 8 0t8 0"/>' },
  generic: { fillColor: "#c9c2a5", strokeColor: "#73694e", pattern: '<path d="M0 8h16m-8-8v16" opacity=".55"/>' }
};

const symbolByCategory = new Map([
  ["01", "field"], ["02", "trees"], ["03", "trees"], ["07", "housing"], ["12", "road"],
  ["17", "water"], ["18", "water"], ["19", "water"], ["20", "water"], ["21", "water"], ["22", "water"], ["24", "water"]
]);

export function symbolForLand(record, variant = "color") {
  const family = symbolByCategory.get(record.code.slice(0, 2)) || "generic";
  const style = teachingSymbols[family];
  return {
    symbolId: ["teaching", family, variant].join("/"),
    classificationKey: record.key,
    standardId: null,
    version: "1",
    mapType: "教学示意",
    scale: null,
    symbolType: "面状示意",
    ...style,
    fillColor: variant === "mono" ? "#faf8f2" : style.fillColor,
    strokeColor: variant === "mono" ? "#35332f" : style.strokeColor,
    density: variant === "dense" ? 0.7 : 1,
    sourceLocator: "本站自制",
    rightsStatus: "允许导出教学示意",
    verificationStatus: "未核验 · 非正式标准图式"
  };
}

export function landCsv(records) {
  const cell = value => {
    const text = String(value ?? "");
    const safe = /^(?:[\u0000-\u0020]*[=+\-@]|[\t\r\n])/u.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const header = ["代码", "名称", "层级", "上级代码", "陆海分类", "自编释义", "用途", "识别方法", "来源", "来源网址", "数据核验状态", "图式核验状态"];
  const rows = records.map(record => [
    record.code, record.name, record.level, record.parent, record.medium, record.summary,
    record.usage, record.identify, record.standard, classificationSource.url,
    "条目释义待逐项校对", symbolForLand(record).verificationStatus
  ]);
  return "\ufeff" + [header, ...rows].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
