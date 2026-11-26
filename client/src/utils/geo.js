/** Browser geolocation helpers for location-restricted check-in. */

export function gymLocationSet(gym) {
  return (
    gym?.latitude !== null &&
    gym?.latitude !== undefined &&
    gym?.latitude !== '' &&
    gym?.longitude !== null &&
    gym?.longitude !== undefined &&
    gym?.longitude !== ''
  );
}

/**
 * Resolves to { latitude, longitude, accuracy } or rejects with a friendly Error.
 * Geolocation only works on HTTPS (or localhost).
 */
export function getCurrentPosition({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This device or browser does not support location.'));
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(new Error('Location needs a secure (https) connection.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
        }),
      (err) => {
        const messages = {
          1: 'Location permission denied. Allow location for this site in your browser settings, then try again.',
          2: 'Could not find your location. Turn on GPS / location services and try again.',
          3: 'Getting your location took too long. Move near a window or turn on GPS and try again.',
        };
        reject(new Error(messages[err.code] || 'Could not get your location.'));
      },
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}

export function mapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
