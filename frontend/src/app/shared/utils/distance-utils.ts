/**
 * Formats a distance for display: metres below 1 km ("850 m"), one decimal below 10 km
 * ("4.2 km"), whole kilometres above that ("1,234 km"). Separators follow the locale.
 */
export function formatDistance(meters: number, locale: string): string {
  const m = Math.round(meters);
  if (m < 1000) {
    return `${new Intl.NumberFormat(locale).format(m)} m`;
  }
  const km = m / 1000;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km)} km`;
}
