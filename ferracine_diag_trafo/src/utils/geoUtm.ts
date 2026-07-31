import { UtmCoordinates } from '../types';

/**
 * Converte latitude e longitude em coordenadas UTM (WGS84)
 */
export function latLonToUtm(lat: number, lon: number): UtmCoordinates {
  const a = 6378137.0; // WGS84 Semi-major axis
  const f = 1 / 298.257223563; // Flattening
  const k0 = 0.9996; // Scale factor

  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;

  // UTM Zone
  let zoneNum = Math.floor((lon + 180) / 6) + 1;
  if (lat >= 56.0 && lat < 64.0 && lon >= 3.0 && lon < 12.0) {
    zoneNum = 32;
  }

  // Central Meridian
  const lonOrigin = (zoneNum - 1) * 6 - 180 + 3;
  const lonOriginRad = (lonOrigin * Math.PI) / 180;

  const e = Math.sqrt(2 * f - f * f);
  const ePrimeSq = (e * e) / (1 - e * e);

  const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = ePrimeSq * Math.cos(latRad) * Math.cos(latRad);
  const A = (lonRad - lonOriginRad) * Math.cos(latRad);

  const M =
    a *
    ((1 -
      (e * e) / 4 -
      (3 * e * e * e * e) / 64 -
      (5 * e * e * e * e * e * e) / 256) *
      latRad -
      ((3 * e * e) / 8 +
        (3 * e * e * e * e) / 32 +
        (45 * e * e * e * e * e * e) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * e * e * e * e) / 256 + (45 * e * e * e * e * e * e) / 1024) *
        Math.sin(4 * latRad) -
      ((35 * e * e * e * e * e * e) / 3072) * Math.sin(6 * latRad));

  let easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ePrimeSq) * A * A * A * A * A) /
          120) +
    500000.0;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(latRad) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ePrimeSq) *
            A *
            A *
            A *
            A *
            A *
            A) /
            720));

  const hemisphere: 'N' | 'S' = lat < 0 ? 'S' : 'N';
  if (lat < 0) {
    northing += 10000000.0; // False northing for southern hemisphere
  }

  // Zone Band Letter determination (optional, e.g., 23K / 23S)
  const zoneLetter = getUtmLetterDesignator(lat);

  return {
    easting: Math.round(easting),
    northing: Math.round(northing),
    zone: `${zoneNum}${zoneLetter}`,
    hemisphere,
    latitude: Math.round(lat * 1000000) / 1000000,
    longitude: Math.round(lon * 1000000) / 1000000
  };
}

/**
 * Converte coordenadas UTM (Easting, Northing, Zone) de volta para Latitude e Longitude (WGS84)
 */
export function utmToLatLon(
  easting: number,
  northing: number,
  zoneStr: string = '23K',
  southernHemisphere: boolean = true
): { latitude: number; longitude: number } {
  const k0 = 0.9996;
  const a = 6378137.0;
  const e = 0.081819191;
  const e1sq = 0.006739497;

  const zoneNum = parseInt(zoneStr.replace(/[^0-9]/g, ''), 10) || 23;

  // Auto-scale northing if entered as 6 digits in 100k..1M range (e.g., 873419 -> 8734190)
  let actualNorthing = northing;
  if (actualNorthing > 100000 && actualNorthing < 1000000) {
    actualNorthing *= 10;
  }

  // Parse letter designator from zoneStr (e.g. "20L", "23K", "20S")
  const letterMatch = zoneStr.match(/[A-Za-z]/);
  let isSouth = southernHemisphere;
  if (letterMatch) {
    const letter = letterMatch[0].toUpperCase();
    if (letter === 'S') {
      isSouth = true;
    } else if (letter >= 'C' && letter <= 'M') {
      isSouth = true; // Bands C through M are Southern Hemisphere
    } else if (letter >= 'N' && letter <= 'X') {
      isSouth = false; // Bands N through X are Northern Hemisphere
    }
  }

  const x = easting - 500000.0;
  let y = actualNorthing;
  if (isSouth) {
    y -= 10000000.0;
  }

  const lonOrigin = (zoneNum - 1) * 6 - 180 + 3;
  const M = y / k0;
  const mu = M / (a * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

  const e1 = (1 - Math.sqrt(1 - Math.pow(e, 2))) / (1 + Math.sqrt(1 - Math.pow(e, 2)));

  const phi1Rad =
    mu +
    (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) +
    (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) +
    (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);

  const N1 = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(phi1Rad), 2));
  const T1 = Math.pow(Math.tan(phi1Rad), 2);
  const C1 = e1sq * Math.pow(Math.cos(phi1Rad), 2);
  const R1 = a * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(phi1Rad), 2), 1.5);
  const D = x / (N1 * k0);

  let lat =
    phi1Rad -
    (N1 * Math.tan(phi1Rad) / R1) *
      (Math.pow(D, 2) / 2 -
        (5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * e1sq) * Math.pow(D, 4) / 24 +
        (61 + 90 * T1 + 298 * C1 + 45 * Math.pow(T1, 2) - 252 * e1sq - 3 * Math.pow(C1, 2)) *
          Math.pow(D, 6) /
          720);
  lat = (lat * 180) / Math.PI;

  let lon =
    (D -
      (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 +
      (5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * e1sq + 24 * Math.pow(T1, 2)) *
        Math.pow(D, 5) /
        120) /
    Math.cos(phi1Rad);
  lon = lonOrigin + (lon * 180) / Math.PI;

  return {
    latitude: Math.round(lat * 1000000) / 1000000,
    longitude: Math.round(lon * 1000000) / 1000000
  };
}

function getUtmLetterDesignator(lat: number): string {
  if (lat >= 84 || lat < -80) return 'Z';
  const letters = 'CDEFGHJKLMNPQRSTUVWXX';
  const index = Math.floor((lat + 80) / 8);
  return letters.charAt(index) || 'K';
}

/**
 * Tenta obter a localização via API Geolocation do navegador
 */
export function getCurrentGpsPosition(): Promise<UtmCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Navegador não suporta Geolocalização/GPS.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const utm = latLonToUtm(latitude, longitude);
        utm.accuracyMeters = Math.round(accuracy);
        resolve(utm);
      },
      (error) => {
        let msg = 'Erro ao obter localização GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permissão de GPS negada pelo usuário.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Sinal de GPS indisponível no momento.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Tempo limite esgotado ao buscar GPS.';
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}
