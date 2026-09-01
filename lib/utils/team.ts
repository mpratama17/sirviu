/**
 * Aturan "siapa boleh jadi kandidat anggota tim" — dipakai untuk mengisi
 * dropdown "Tambah anggota..." baik di /team (self-service Ketua Tim)
 * maupun /admin/users (panel admin). Sebelumnya di-copy-paste identik di
 * kedua page.tsx; diekstrak di sini supaya kelas bug "aturan yang cuma
 * hidup di satu tempat" (AGENTS.md) tidak terulang di layer UI juga.
 *
 * Hanya menentukan tampilan dropdown — RPC assign_team_member menegakkan
 * aturan yang sama lagi di server, trust boundary sebenarnya. `roles` pakai
 * `string[]` (bukan `Role[]`) karena query Supabase mengembalikan kolom
 * `text[]` mentah — sama seperti `SelectableUser.roles`.
 */
export function isAssignableTeamCandidate(user: {
  isActive: boolean;
  teamKetuaTimId: string | null;
  roles: readonly string[];
}): boolean {
  return (
    user.isActive &&
    user.teamKetuaTimId === null &&
    !user.roles.includes("ketua_tim") &&
    !user.roles.includes("admin") &&
    user.roles.some((r) => r === "dalnis" || r === "dalmut" || r === "operator")
  );
}
