function isoDateParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, iso: `${match[1]}-${match[2]}-${match[3]}` };
}

function addUtcDays(isoDate, amount) {
  const parts = isoDateParts(isoDate);
  if (!parts) return "";
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return date.toISOString().slice(0, 10);
}

export function canManageKnowledgeShares(authenticated, accessKind) {
  return authenticated === true && accessKind === "session";
}

export function explicitEventDate(item = {}) {
  for (const value of [item.event_at, item.start_at, item.due_at]) {
    const parts = isoDateParts(value);
    if (parts) return parts.iso;
  }
  return "";
}

export function partitionKnowledge(items = []) {
  const reminders = [];
  const memos = [];
  for (const item of items) {
    if (item?.category === "日程") reminders.push(item);
    else memos.push(item);
  }
  return { reminders, memos };
}

export function groupReminders(items = [], today) {
  const normalizedToday = isoDateParts(today)?.iso;
  if (!normalizedToday) throw new TypeError("today must be an ISO date in YYYY-MM-DD format");
  const nearBoundary = addUtcDays(normalizedToday, 7);
  const upcoming = [];
  const later = [];
  const unscheduled = [];

  for (const item of items) {
    const date = explicitEventDate(item);
    if (!date) unscheduled.push(item);
    else if (date <= nearBoundary) upcoming.push(item);
    else later.push(item);
  }

  const byDate = (left, right) => explicitEventDate(left).localeCompare(explicitEventDate(right))
    || String(left.title || "").localeCompare(String(right.title || ""), "zh-CN");
  upcoming.sort(byDate);
  later.sort(byDate);
  return { upcoming, later, unscheduled };
}

export function calendarMonth(year, month, items = []) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new TypeError("calendarMonth requires a year and a month from 1 to 12");
  }

  const first = new Date(Date.UTC(year, month - 1, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month - 1, 1 - mondayOffset));
  const schedulesByDate = new Map();

  for (const item of items) {
    if (item?.category !== "日程") continue;
    const date = explicitEventDate(item);
    if (!date) continue;
    const scheduled = schedulesByDate.get(date) || [];
    scheduled.push(item.id);
    schedulesByDate.set(date, scheduled);
  }

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);
    const itemIds = schedulesByDate.get(iso) || [];
    return {
      date: iso,
      day: date.getUTCDate(),
      inMonth: date.getUTCFullYear() === year && date.getUTCMonth() === month - 1,
      count: itemIds.length,
      itemIds: [...itemIds]
    };
  });
}
