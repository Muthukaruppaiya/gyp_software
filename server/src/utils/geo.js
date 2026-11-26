/** Geofence helpers for location-restricted self check-in / check-out. */

export const DEFAULT_RADIUS_M = 100;
export const MIN_RADIUS_M = 25;
export const MAX_RADIUS_M = 2000;
// GPS accuracy we forgive on top of the radius. Caps how far a poor fix can stretch the fence.
const MAX_ACCURACY_ALLOWANCE_M = 50;

const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function parseLatitude(v) {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && n >= -90 && n <= 90 ? n : null;
}

export function parseLongitude(v) {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && n >= -180 && n <= 180 ? n : null;
}

/**
 * Decide whether a member at `body.latitude/longitude` may self check-in/out at the gym.
 * Returns { ok: true, distance } or { ok: false, status, code, error, distance? }.
 */
export function checkGeofence(gym, body = {}) {
  const gymLat = parseLatitude(gym?.latitude);
  const gymLng = parseLongitude(gym?.longitude);
  if (gymLat === null || gymLng === null) {
    return {
      ok: false,
      status: 403,
      code: 'GYM_LOCATION_NOT_SET',
      error: 'Self check-in is not available yet. Please check in at the front desk.',
    };
  }

  const lat = parseLatitude(body.latitude);
  const lng = parseLongitude(body.longitude);
  if (lat === null || lng === null) {
    return {
      ok: false,
      status: 400,
      code: 'LOCATION_REQUIRED',
      error: 'Turn on location access to check in or check out.',
    };
  }

  const radius = Number(gym.geofence_radius_m) || DEFAULT_RADIUS_M;
  const accuracy = Math.max(0, Number(body.accuracy) || 0);
  const distance = Math.round(distanceMeters(gymLat, gymLng, lat, lng));
  const allowed = radius + Math.min(accuracy, MAX_ACCURACY_ALLOWANCE_M);

  if (distance > allowed) {
    const far = distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`;
    return {
      ok: false,
      status: 403,
      code: 'OUTSIDE_GYM',
      distance,
      error: `You are ${far} away from the gym. You can only check in or out at the gym.`,
    };
  }
  return { ok: true, distance };
}
