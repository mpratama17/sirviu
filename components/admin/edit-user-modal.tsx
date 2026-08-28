"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RoleMultiSelect } from "@/components/admin/role-multi-select";
import { updateUser } from "@/lib/actions/admin";
import type { Role } from "@/lib/types/domain";

export interface EditableUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  isActive: boolean;
}

export function EditUserModal({
  user,
  open,
  onOpenChange,
}: {
  user: EditableUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const [isActive, setIsActive] = useState(user.isActive);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    const formData = new FormData();
    formData.set("userId", user.id);
    formData.set("name", name);
    formData.set("isActive", String(isActive));
    roles.forEach((r) => formData.append("roles", r));

    startTransition(async () => {
      const result = await updateUser(formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Perubahan disimpan.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Pengguna</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Email</Label>
            <Input value={user.email} disabled />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-user-name">Nama</Label>
            <Input id="edit-user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Roles</Label>
            <RoleMultiSelect value={roles} onChange={setRoles} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
            Aktif
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim() || roles.length === 0}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
