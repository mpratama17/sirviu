import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // `field-sizing-fixed`, BUKAN `-content` (default shadcn). Dengan
        // `field-sizing: content` Chrome mengukur lebar textarea dari isinya
        // dan MENIMPA `w-full` — satu kata panjang tanpa spasi bikin lebarnya
        // ribuan piksel dan menjulur keluar dialog. Diukur langsung di browser:
        // 4972px vs dialog 576px. `min-w-0` maupun `max-w-full` tidak menolong
        // (parent-nya ikut membengkak, jadi 100% pun tetap besar); hanya
        // mematikan field-sizing yang benar. Efek sampingnya: tinggi kembali
        // ditentukan `rows`/`min-h-*`, bukan auto-grow — itu yang kita mau.
        "flex field-sizing-fixed min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
