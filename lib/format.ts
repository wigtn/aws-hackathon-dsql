export function ms(n: number): string {
  return `${Math.round(n)}ms`;
}

export function relTime(target: number, now = Date.now()): string {
  const d = target - now;
  const abs = Math.abs(d);
  const m = Math.floor(abs / 60000);
  const h = Math.floor(m / 60);
  const s = Math.floor((abs % 60000) / 1000);
  let body: string;
  if (h > 0) body = `${h}h ${m % 60}m`;
  else if (m > 0) body = `${m}m ${s}s`;
  else body = `${s}s`;
  return d >= 0 ? `in ${body}` : `${body} ago`;
}

export function pad(n: number, w = 2): string {
  return n.toString().padStart(w, "0");
}

export function distanceLabel(km: number | null): string {
  if (km == null) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
