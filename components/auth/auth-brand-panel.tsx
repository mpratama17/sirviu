import { CheckCircle2 } from "lucide-react";
import { STAGE_DEFINITIONS } from "@/lib/constants/stages";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { Stage } from "@/lib/types/domain";

/** Deskripsi singkat per stage — pelengkap `STAGE_DEFINITIONS[n].name`, khusus untuk konteks di halaman login (bukan dipakai di tempat lain). */
const STAGE_BLURB: Record<Stage, string> = {
  1: "Ketua Tim menyusun draf laporan.",
  2: "Pengendali Teknis meninjau isi & metodologi.",
  3: `${ROLE_LABELS.dalmut} memastikan standar mutu.`,
  4: "Operator merapikan format sebelum rilis.",
  5: "Laporan final, siap didistribusikan.",
};

const STAGES: readonly Stage[] = [1, 2, 3, 4, 5];

/**
 * Panel kiri halaman login/register (desktop saja, `lg:` ke atas) — bukan
 * dekorasi generik, tapi ringkasan alur 5-stage yang sesungguhnya dijalankan
 * aplikasi ini (`STAGE_DEFINITIONS`), supaya orang yang baru pertama kali
 * lihat langsung paham apa yang mereka masuki.
 */
export function AuthBrandPanel() {
  return (
    <div className="relative hidden w-[420px] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0f172a] to-[#1e3a8a] px-10 py-12 text-white lg:flex">
      {/* Radial glow, murni dekoratif — subtle, tidak menutupi konten. */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-sm font-bold text-[#1e3a8a]">
          S
        </div>
        <div className="leading-none">
          <div className="text-sm font-bold tracking-tight">SIRVIU</div>
          <div className="mt-0.5 text-[11px] text-white/60">
            Reviu Berjenjang LHP
          </div>
        </div>
      </div>

      <div className="relative">
        <h2 className="text-[22px] font-semibold leading-snug tracking-tight text-balance">
          Reviu berjenjang, satu alur yang jelas.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          Setiap laporan hasil pemeriksaan melewati lima tahap tetap, dengan
          jejak audit lengkap di setiap langkahnya.
        </p>

        <ol className="mt-8 flex flex-col">
          {STAGES.map((stage, i) => {
            const isLast = i === STAGES.length - 1;
            return (
              <li key={stage} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span
                    className={
                      isLast
                        ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[#0f172a]"
                        : "flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold tabular-nums"
                    }
                  >
                    {isLast ? (
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    ) : (
                      stage
                    )}
                  </span>
                  {!isLast ? (
                    <span className="my-0.5 w-px flex-1 bg-white/15" aria-hidden="true" />
                  ) : null}
                </div>
                <div className={isLast ? "pb-0" : "pb-5"}>
                  <p className="text-[13px] font-medium leading-tight">
                    {STAGE_DEFINITIONS[stage].name}
                  </p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-white/55">
                    {STAGE_BLURB[stage]}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="relative text-[11px] text-white/40">
        © {new Date().getFullYear()} Inspektorat — Internal use only.
      </p>
    </div>
  );
}
