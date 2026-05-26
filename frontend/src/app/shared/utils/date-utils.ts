export function isEpochSentinel(dateStr: string): boolean {
  if (!dateStr) return false;
  const ms = Date.parse(dateStr.trim().replace(' ', 'T') + 'Z');
  return !isNaN(ms) && Math.abs(ms) <= 14 * 3600 * 1000;
}

export function formatDateForInput(backendDate: string): string {
  if (!backendDate) return '';
  const d = new Date(backendDate.replace(' ', 'T') + 'Z');
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateForBackend(inputDate: string): string {
  if (!inputDate) return '';
  const d = new Date(inputDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
