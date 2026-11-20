require("./load-typescript.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { geohash, profileGeoCell, nearbyGeoCells } = require("../src/geo-cells.ts");

test("geohash matches the reference encoding", () => {
  assert.equal(geohash(52.2297, 21.0122, 5), "u3qcn");
  assert.equal(geohash(40.7128, -74.006, 5), "dr5re");
  assert.equal(geohash(52.2297, 21.0122), "u3q");
});

test("profile cell is null without a usable location", () => {
  assert.equal(profileGeoCell(null), null);
  assert.equal(profileGeoCell({ latitude: "52", longitude: 21 }), null);
  assert.equal(profileGeoCell({ latitude: 95, longitude: 21 }), null);
  assert.equal(profileGeoCell({ latitude: 52.23, longitude: 21.01 }), "u3q");
});

test("nearby cells cover profiles about 90 km away in every direction", () => {
  const warsaw = { latitude: 52.23, longitude: 21.01 };
  const cells = nearbyGeoCells(warsaw);
  assert.ok(cells.length >= 4 && cells.length <= 9);
  for (const [dLat, dLon] of [[0.8, 0], [-0.8, 0], [0, 1.3], [0, -1.3], [0.6, 0.9]]) {
    assert.ok(cells.includes(profileGeoCell({ latitude: warsaw.latitude + dLat, longitude: warsaw.longitude + dLon })), `${dLat},${dLon}`);
  }
  assert.ok(!cells.includes(profileGeoCell({ latitude: 40.71, longitude: -74.0 })));
});

test("cells wrap at the date line and stop at the poles", () => {
  assert.ok(nearbyGeoCells({ latitude: 0, longitude: 179.9 }).length === 9);
  assert.ok(nearbyGeoCells({ latitude: 89.9, longitude: 0 }).length <= 6);
});
