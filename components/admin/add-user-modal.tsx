"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleMultiSelect } from "@/components/admin/role-multi-select";
import { addUser } from "@/lib/actions/admin";
import type { Role } from "@/lib/types/domain";

export function AddUserModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const formData = new FormData();
    formData.set("email", email);
    formData.set("name", name);
    roles.forEach((r) => formData.append("roles", r));

    startTransition(async () => {
      const result = await addUser(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Undangan berhasil dikirim.");
      setEmail("");
      setName("");
      setRoles([]);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>+ Tambah Pengguna</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Pengguna</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-user-email">Email</Label>
            <Input
              id="add-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@instansi.go.id"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-user-name">Nama</Label>
            <Input id="add-user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Roles</Label>
            <RoleMultiSelect value={roles} onChange={setRoles} />
          </div>

          <div className="flex gap-2 rounded-md bg-secondary p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>Pengguna akan menerima invite via email dan bisa login menggunakan Google.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !email.trim() || !name.trim() || roles.length === 0}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Kirim Undangan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
