/**
 * Utilitário de Geocodificação Reversa para Aquisição de Município e UF
 * a partir de Coordenadas Geográficas (Latitude e Longitude)
 */

const BRAZIL_STATE_UF_MAP: Record<string, string> = {
  'Acre': 'AC',
  'Alagoas': 'AL',
  'Amapá': 'AP',
  'Amazonas': 'AM',
  'Bahia': 'BA',
  'Ceará': 'CE',
  'Distrito Federal': 'DF',
  'Espírito Santo': 'ES',
  'Goiás': 'GO',
  'Maranhão': 'MA',
  'Mato Grosso': 'MT',
  'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG',
  'Pará': 'PA',
  'Paraíba': 'PB',
  'Paraná': 'PR',
  'Pernambuco': 'PE',
  'Piauí': 'PI',
  'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS',
  'Rondônia': 'RO',
  'Roraima': 'RR',
  'Santa Catarina': 'SC',
  'São Paulo': 'SP',
  'Sergipe': 'SE',
  'Tocantins': 'TO'
};

export interface ReverseGeocodeResult {
  city: string;
  state: string;
  uf: string;
  formatted: string; // Ex: "Cacoal - RO"
}

export async function reverseGeocodeCoords(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
    return null;
  }

  // 1ª Tentativa: BigDataCloud Reverse Geocode Client API (rápido, gratuito, CORS aberto)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=pt`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || (data.localityInfo?.administrative?.find((a: any) => a.adminLevel === 8)?.name) || '';
      let uf = '';
      if (data.principalSubdivisionCode && data.principalSubdivisionCode.startsWith('BR-')) {
        uf = data.principalSubdivisionCode.replace('BR-', '');
      } else if (data.principalSubdivision) {
        uf = BRAZIL_STATE_UF_MAP[data.principalSubdivision] || data.principalSubdivision;
      }

      if (city) {
        const formatted = uf ? `${city} - ${uf}` : city;
        return {
          city,
          state: data.principalSubdivision || '',
          uf,
          formatted
        };
      }
    }
  } catch {
    // Falha silenciosa na 1ª tentativa, segue para o fallback
  }

  // 2ª Tentativa: OpenStreetMap Nominatim API (Fallback)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
      {
        signal: controller.signal,
        headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || '';
      let uf = '';
      if (addr['ISO3166-2-lvl4'] && addr['ISO3166-2-lvl4'].startsWith('BR-')) {
        uf = addr['ISO3166-2-lvl4'].replace('BR-', '');
      } else if (addr.state) {
        uf = BRAZIL_STATE_UF_MAP[addr.state] || addr.state;
      }

      if (city) {
        const formatted = uf ? `${city} - ${uf}` : city;
        return {
          city,
          state: addr.state || '',
          uf,
          formatted
        };
      }
    }
  } catch {
    // Falha silenciosa
  }

  return null;
}
