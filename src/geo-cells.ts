// Coarse location cells for Discover: the server returns nearby profiles first
// instead of the newest profiles worldwide. A 3-character geohash cell is
// 1.40625° x 1.40625° (about 156 x 100-156 km), so a cell and its 8 neighbours
// cover the default 100 km search radius.
const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const cellDegrees = 1.40625;

export const geoCellPrecision = 3;

export function geohash(latitude: number, longitude: number, precision = geoCellPrecision) {
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  let hash = "", bits = 0, value = 0, evenBit = true;
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lonMin + lonMax) / 2;
      if (longitude >= mid) { value = value * 2 + 1; lonMin = mid; } else { value *= 2; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (latitude >= mid) { value = value * 2 + 1; latMin = mid; } else { value *= 2; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bits === 5) { hash += base32[value]; bits = 0; value = 0; }
  }
  return hash;
}

function validPoint(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === "number" && typeof longitude === "number"
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

/** The profile's own cell, or null without a usable location. */
export function profileGeoCell(location: { latitude?: unknown; longitude?: unknown } | null | undefined) {
  if (!location || !validPoint(location.latitude, location.longitude)) return null;
  return geohash(location.latitude as number, location.longitude as number);
}

/** The person's cell plus its 8 neighbours (deduplicated, at most 9; wraps at the date line). */
export function nearbyGeoCells(location: { latitude?: unknown; longitude?: unknown } | null | undefined) {
  if (!location || !validPoint(location.latitude, location.longitude)) return [];
  const latitude = location.latitude as number;
  const longitude = location.longitude as number;
  const cells = new Set<string>();
  for (const dLat of [-cellDegrees, 0, cellDegrees]) {
    const lat = latitude + dLat;
    if (lat < -90 || lat > 90) continue;
    for (const dLon of [-cellDegrees, 0, cellDegrees]) {
      let lon = longitude + dLon;
      if (lon < -180) lon += 360;
      if (lon >= 180) lon -= 360;
      cells.add(geohash(lat, lon));
    }
  }
  return Array.from(cells);
}
