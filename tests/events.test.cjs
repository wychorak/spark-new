require("./load-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matchingCities, searchKey, parseEventDate, validateEventFields } = require("../src/events/event-form-model.ts");
const { normalizeSparkEvent, parseEventDateTimeInput, sanitizeActiveEvents, getSharedActiveEvents } = require("../src/events.ts");
const now = new Date(2026, 10, 8, 12).getTime();

test("Polish city suggestions work without diacritics, unknown localities remain valid", () => {
  assert.ok(matchingCities("lodz").includes("Łódź"));
  assert.ok(matchingCities("bial").includes("Białystok"));
  assert.equal(searchKey("  ŁÓDŹ  "), "lodz");
  assert.ok(matchingCities("").length > 0);
  assert.equal(validateEventFields("Koncert", "Moja mała miejscowość", "2026-11-09 18:00", "2026-11-09 21:00", now).errors.length, 0);
});

test("dates reject rollover, malformed time, invalid years and non-leap days", () => {
  for (const date of ["31.02.2026", "29.02.2025", "01.13.2026", "01.01.0000", "01.01.0099"]) assert.equal(parseEventDate(date, "18:00"), null);
  assert.notEqual(parseEventDate("29.02.2028", "18:00"), null);
  for (const time of ["24:00", "18:60", "18:3", "bad"]) assert.equal(parseEventDate("09.11.2026", time), null);
  assert.equal(parseEventDateTimeInput("2026-02-31 18:00"), null);
});

test("new events must start in the future and end after their start, within 400 days", () => {
  const check = (start, end, admin = false) => validateEventFields("Koncert", "Łódź", start, end, now, admin).errors;
  assert.equal(check("2026-11-09 18:00", "2026-11-10 02:00").length, 0);
  assert.ok(check("2026-11-08 11:00", "2026-11-08 21:00").length > 0);
  assert.equal(check("2026-11-08 11:00", "2026-11-08 21:00", true).length, 0);
  assert.ok(check("2026-11-09 21:00", "2026-11-09 18:00").length > 0);
  assert.ok(check("2026-11-09 21:00", "2026-11-09 21:00").length > 0);
  assert.ok(check("2028-11-09 18:00", "2028-11-09 21:00").length > 0);
  assert.ok(check("2026-11-08 09:00", "2026-11-08 11:00", true).length > 0);
});

test("blank required fields and invalid range cannot produce a valid form", () => {
  assert.ok(validateEventFields("", "", "", "", now).errors.length >= 3);
  assert.ok(validateEventFields("abc", "x", "2026-11-09 18:00", "2026-11-09 21:00", now).errors.length > 0);
});

test("catalogue schema, deterministic IDs and event expiry remain compatible with remote main", () => {
  const event = normalizeSparkEvent({ category: "music", icon: "guitar-electric", name: "Koncert", city: "Łódź", kind: "specific", startsAt: "2026-11-09T18:00:00.000Z", endsAt: "2026-11-09T21:00:00.000Z" });
  assert.ok(event);
  assert.deepEqual(normalizeSparkEvent(event), event);
  assert.equal(event.icon, "guitar-electric");
  assert.equal(getSharedActiveEvents([event], [event], now).length, 1);
  assert.equal(sanitizeActiveEvents([event], Date.parse("2026-11-09T22:00:00Z")).length, 0);
});
