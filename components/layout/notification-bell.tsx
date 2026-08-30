"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";

export interface NotificationItem {
  id: string;
  documentId: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

/**
 * Bell di header. Server component page menyediakan `items` (max 10
 * terbaru) + `unreadCount`. Klik item: mark as read + navigate.
 * Klik "Tandai semua dibaca": mark_all_notifications_read RPC.
 */
export function NotificationBell({
  items,
  unreadCount,
}: {
  items: readonly NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClickItem(item: NotificationItem) {
    setOpen(false);
    // Fire-and-forget mark as read; navigate immediately.
    if (!item.readAt) {
      startTransition(async () => {
        await markNotificationRead(item.id);
        router.refresh();
      });
    }
    router.push(`/documents/${item.documentId}`);
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={
              unreadCount > 0
                ? `Notifikasi (${unreadCount} baru)`
                : "Notifikasi"
            }
            className="relative shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          />
        }
      >
        <Bell className="size-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            className="absolute right-1 top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground tabular-nums"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-sm font-medium text-foreground">Notifikasi</p>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleMarkAll}
              disabled={isPending}
              className="text-xs"
            >
              {isPending ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCheck className="size-3" aria-hidden="true" />
              )}
              Tandai semua dibaca
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada notifikasi.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleClickItem(item)}
                  className={cn(
                    "flex w-full flex-col items-start gap-1 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-secondary",
                    !item.readAt && "bg-primary/[0.04]",
                  )}
                >
                  <div className="flex w-full items-start gap-2">
                    {!item.readAt ? (
                      <span
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="mt-1.5 size-1.5 shrink-0" aria-hidden="true" />
                    )}
                    <p className="flex-1 text-sm text-foreground">{item.message}</p>
                  </div>
                  <span className="pl-3.5 text-xs text-text-muted">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                      locale: idLocale,
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border p-2">
          <Link
            href="/dashboard?scope=mine"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-1.5 text-center text-xs font-medium text-primary hover:bg-secondary"
          >
            Lihat semua dokumen saya
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
