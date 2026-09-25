import test from "node:test";
import assert from "node:assert/strict";

import {
  canManageKnowledgeShares,
  calendarMonth,
  explicitEventDate,
  groupReminders,
  partitionKnowledge
} from "../knowledge-model.js";

test("share management is available only to an authenticated owner session", () => {
  assert.equal(canManageKnowledgeShares(true, "session"), true);
  assert.equal(canManageKnowledgeShares(true, "share"), false);
  assert.equal(canManageKnowledgeShares(false, "session"), false);
});

test("explicitEventDate ignores note timestamps and accepts an explicit schedule date", () => {
  assert.equal(explicitEventDate({
    category: "日程",
    created_at: "2026-09-25T09:00:00+08:00",
    updated_at: "2026-09-25T11:00:00+08:00"
  }), "");
  assert.equal(explicitEventDate({ due_at: "2026-09-28T14:00:00+08:00" }), "2026-09-28");
});

test("explicitEventDate rejects malformed and impossible dates", () => {
  assert.equal(explicitEventDate({ event_at: "2026-02-30" }), "");
  assert.equal(explicitEventDate({ start_at: "下周一" }), "");
  assert.equal(explicitEventDate({ due_at: "2026-9-2" }), "");
});

test("partitionKnowledge exposes schedules only as reminders", () => {
  const result = partitionKnowledge([
    { id: "schedule", category: "日程" },
    { id: "memo", category: "工作经验" },
    { id: "uncategorized", category: "" }
  ]);

  assert.deepEqual(result.reminders.map(item => item.id), ["schedule"]);
  assert.deepEqual(result.memos.map(item => item.id), ["memo", "uncategorized"]);
});

test("groupReminders keeps past and next seven days visible and leaves missing dates unscheduled", () => {
  const result = groupReminders([
    { id: "past", category: "日程", event_at: "2026-09-20" },
    { id: "today", category: "日程", event_at: "2026-09-25" },
    { id: "seven", category: "日程", due_at: "2026-10-02" },
    { id: "later", category: "日程", start_at: "2026-10-03" },
    { id: "none", category: "日程", created_at: "2026-09-25" }
  ], "2026-09-25");

  assert.deepEqual(result.upcoming.map(item => item.id), ["past", "today", "seven"]);
  assert.deepEqual(result.later.map(item => item.id), ["later"]);
  assert.deepEqual(result.unscheduled.map(item => item.id), ["none"]);
});

test("calendarMonth returns a Monday-first 42-cell grid with explicit schedule counts", () => {
  const cells = calendarMonth(2026, 9, [
    { id: "a", category: "日程", event_at: "2026-09-01" },
    { id: "b", category: "日程", due_at: "2026-09-01T18:00:00+08:00" },
    { id: "memo", category: "思想日记", event_at: "2026-09-01" },
    { id: "created-only", category: "日程", created_at: "2026-09-02" }
  ]);

  assert.equal(cells.length, 42);
  assert.equal(cells[0].date, "2026-08-31");
  assert.equal(cells[0].inMonth, false);
  assert.deepEqual(cells[1], {
    date: "2026-09-01",
    day: 1,
    inMonth: true,
    count: 2,
    itemIds: ["a", "b"]
  });
  assert.equal(cells[41].date, "2026-10-11");
});
