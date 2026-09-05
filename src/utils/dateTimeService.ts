/**
 * Serviço Unificado de Obtenção de Data e Hora
 * Prioridade: Relógio do Dispositivo Local
 * Fallback: Sincronização via Rede (Cloudflare Trace / GitHub API / HTTP HEAD)
 */

export function formatDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatTimeWithSeconds(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Tenta buscar o timestamp exato da rede como fallback
 */
export async function fetchNetworkDate(): Promise<Date | null> {
  // 1. Tenta Cloudflare trace (CORS aberto, retorno < 100ms)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://cloudflare.com/cdn-cgi/trace', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/ts=([\d.]+)/);
      if (match && match[1]) {
        const sec = parseFloat(match[1]);
        if (!isNaN(sec) && sec > 0) {
          return new Date(sec * 1000);
        }
      }
    }
  } catch {
    // Fallback silencioso
  }

  // 2. Tenta cabeçalho Date via HEAD request (GitHub API)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.github.com', { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const parsed = new Date(dateHeader);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  } catch {
    // Fallback silencioso
  }

  return null;
}

/**
 * Obtém a data e hora formatada de acordo com o dispositivo, com rede como fallback
 */
export async function getAutoDateTime(): Promise<string> {
  const deviceDate = new Date();
  const isValidDeviceDate = !isNaN(deviceDate.getTime()) && deviceDate.getFullYear() >= 2024;

  if (isValidDeviceDate) {
    return formatDateTime(deviceDate);
  }

  // Se o relógio do dispositivo estiver corrompido ou descalibrado (< 2024)
  const networkDate = await fetchNetworkDate();
  if (networkDate && !isNaN(networkDate.getTime())) {
    return formatDateTime(networkDate);
  }

  return formatDateTime(deviceDate);
}

/**
 * Retorna a data e hora do dispositivo imediatamente (síncrono)
 */
export function getDeviceDateTime(): string {
  const now = new Date();
  return formatDateTime(now);
}
