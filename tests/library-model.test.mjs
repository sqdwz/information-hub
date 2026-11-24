import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { filterLand, landCsv, landSceneUrl, readLandData, symbolForLand } from "../assets/js/library-model.js";

const entries = JSON.parse(await readFile(new URL("../assets/library/landuse-data.json", import.meta.url), "utf8"));
const catalog = readLandData(entries);

test("the bundled atlas retains all explicit codes and their parent hierarchy", () => {
  assert.equal(catalog.records.length, 175);
  assert.equal(catalog.byCode.size, 175);
  assert.deepEqual([1, 2, 3].map(level => catalog.records.filter(record => record.level === level).length), [24, 111, 40]);
  assert.equal(catalog.byCode.get("0201").key, "mnr-land-use/2023/0201");
  assert.throws(() => readLandData([...entries, entries[0]]), /Invalid land classification/);
  assert.throws(() => readLandData([{ ...entries[0], code: 1 }]), /Invalid land classification/);
});

test("atlas search prioritizes exact codes and names while composing filters", () => {
  assert.deepEqual(filterLand(catalog.records, { query: "0201" }).map(record => record.code), ["0201"]);
  assert.deepEqual(filterLand(catalog.records, { query: "0103" }).map(record => record.code), ["0103"]);
  assert.equal(filterLand(catalog.records, { query: "旱地" })[0]?.code, "0103");
  const oceanClasses = filterLand(catalog.records, { medium: "海域", level: "2", category: "18", sort: "code" });
  assert.ok(oceanClasses.length > 1);
  assert.ok(oceanClasses.every(record => record.parent === "18" && record.medium === "海域" && record.level === 2));
  assert.deepEqual(filterLand(catalog.records, { query: "0201", medium: "海域" }), []);
});

test("only curated land comparisons are presented", () => {
  assert.deepEqual(catalog.related(catalog.byCode.get("0201")).map(record => record.code), ["0205", "0103", "0301"]);
  assert.deepEqual(catalog.related(catalog.byCode.get("1207")), []);
});

test("every atlas code has a bundled WebP scene at its own URL", async () => {
  const urls = new Set();
  for (const record of catalog.records) {
    const url = landSceneUrl(record);
    assert.ok(!urls.has(url.href), record.code);
    urls.add(url.href);
    const content = await readFile(url);
    assert.equal(content.subarray(0, 4).toString("ascii"), "RIFF", record.code);
    assert.equal(content.subarray(8, 12).toString("ascii"), "WEBP", record.code);
  }
});

test("CSV retains string codes, sanitizes spreadsheet formulas and carries teaching symbol status", () => {
  const orchard = catalog.byCode.get("0201");
  const csv = landCsv([{ ...orchard, summary: ' =HYPERLINK("fixture")' }]);
  assert.ok(csv.startsWith('\ufeff"代码"'));
  assert.match(csv, /"0201","果园","2","02","陆域"/);
  assert.ok(csv.includes("\"' =HYPERLINK(\"\"fixture\"\")\""));
  assert.match(csv, /未核验 · 非正式标准图式/);
  const teachingSymbol = symbolForLand(orchard, "mono");
  assert.equal(teachingSymbol.classificationKey, orchard.key);
  assert.equal(teachingSymbol.standardId, null);
  assert.equal(teachingSymbol.mapType, "教学示意");
});
