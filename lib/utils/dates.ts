/**
 * Helper tanggal kecil. Sengaja bukan dipanggil langsung di body komponen —
 * `Date.now()` di dalam render dianggap impure oleh React Compiler
 * (`react-hooks/purity`). Hitung di data-fetching layer (page.tsx), lempar
 * angka jadi ke komponen presentational.
 */
export function daysSince(isoTimestamp: string): number {
  return Math.floor(
    (Date.now() - new Date(isoTimestamp).getTime()) / (1000 * 60 * 60 * 24),
  );
}
