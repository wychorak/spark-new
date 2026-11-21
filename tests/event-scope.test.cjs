require("./load-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { eventScopeOf, eventCountryOf, isEventVisibleTo, filterAndSortEvents, countByScale, eventCountryName } = require("../src/events/event-scope.ts");

const ev = (id, name, city, category, startsAt) => ({ id, name, city, category, startsAt, endsAt: startsAt, date: startsAt.slice(0, 10), kind: "specific", icon: "music-note" });
const events = [
  ev("waw-film", "Avengers", "Warszawa", "cinema", "2026-12-16T17:00:00.000Z"),
  ev("szc-gig", "Koncert w Szczecinie", "Szczecin", "music", "2027-01-10T18:00:00.000Z"),
  ev("pl-fest", "Orange Festival", "Warszawa", "music", "2027-06-11T13:00:00.000Z"),
  ev("world", "Premiera gry", "Online", "games", "2026-12-01T10:00:00.000Z"),
  ev("de-fest", "Rock am Ring", "Nürburg", "music", "2027-06-05T10:00:00.000Z"),
  ev("nyc", "Knicks", "New York", "sport", "2026-12-20T00:00:00.000Z")
];
const details = {
  "waw-film": {},
  "szc-gig": { countryCode: "PL" },
  "pl-fest": { scope: "national", countryCode: "PL" },
  "world": { scope: "global", countryCode: "PL" },
  "de-fest": { scope: "national", countryCode: "DE" },
  "nyc": { countryCode: "US" }
};
const base = { userCountryCode: "PL", userCity: "Szczecin", category: "all", query: "" };

test("old events default to local and Polish", () => {
  assert.equal(eventScopeOf(undefined), "local");
  assert.equal(eventScopeOf({ scope: "weird" }), "local");
  assert.equal(eventCountryOf({}), "PL");
  assert.equal(eventCountryName("DE"), "Niemcy");
});

test("global events reach every country, others only their own", () => {
  assert.equal(isEventVisibleTo(details.world, "US"), true);
  assert.equal(isEventVisibleTo(details["pl-fest"], "US"), false);
  assert.equal(isEventVisibleTo(details.nyc, "US"), true);
  const ids = filterAndSortEvents(events, details, { ...base, scale: "all", sort: "soonest" }).map((e) => e.id);
  assert.deepEqual(ids, ["world", "waw-film", "szc-gig", "pl-fest"]);
});

test("reach filter: local means my city, national and global by scope", () => {
  const ids = (scale) => filterAndSortEvents(events, details, { ...base, scale, sort: "soonest" }).map((e) => e.id);
  assert.deepEqual(ids("local"), ["szc-gig"]);
  assert.deepEqual(ids("national"), ["pl-fest"]);
  assert.deepEqual(ids("global"), ["world"]);
  assert.deepEqual(countByScale(events, details, base), { all: 4, local: 1, national: 1, global: 1 });
  // Without a city, local shows every local event in the country.
  assert.deepEqual(filterAndSortEvents(events, details, { ...base, userCity: "", scale: "local", sort: "soonest" }).map((e) => e.id), ["waw-film", "szc-gig"]);
});

test("category filter, search and sorting", () => {
  assert.deepEqual(filterAndSortEvents(events, details, { ...base, category: "music", scale: "all", sort: "name" }).map((e) => e.id), ["szc-gig", "pl-fest"]);
  assert.deepEqual(filterAndSortEvents(events, details, { ...base, scale: "all", sort: "nearby" }).map((e) => e.id), ["szc-gig", "pl-fest", "waw-film", "world"]);
  assert.deepEqual(filterAndSortEvents(events, details, { ...base, scale: "all", sort: "soonest", query: "warszawa" }).map((e) => e.id), ["waw-film", "pl-fest"]);
});
