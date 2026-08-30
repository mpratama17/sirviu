"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOwnProfile } from "@/lib/actions/profile";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [value, setValue] = useState(name);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateOwnProfile(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Profil berhasil diperbarui.");
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-name">Nama</Label>
        <Input
          id="profile-name"
          name="name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={email} disabled />
        <p className="text-xs text-text-muted">
          Terhubung dengan akun Google/login. Tidak dapat diubah.
        </p>
      </div>
      <Button type="submit" disabled={isPending || value.trim() === name} className="self-start">
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Simpan Perubahan
      </Button>
    </form>
  );
}
