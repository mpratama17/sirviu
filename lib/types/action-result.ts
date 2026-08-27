/**
 * Return type standar untuk semua server actions (brief §11) — jangan
 * throw ke caller, selalu return shape ini supaya UI bisa handle error
 * tanpa try/catch di komponen.
 */
export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };
