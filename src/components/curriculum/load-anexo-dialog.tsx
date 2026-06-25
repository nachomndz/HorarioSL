"use client";

import { useState } from "react";
import {
  DEFAULT_PRIMARIA_ELECTIVES,
  type PrimariaElectiveChoices,
} from "@/lib/curriculum/templates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LoadAnexoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (choices: PrimariaElectiveChoices) => void | Promise<void>;
  loading?: boolean;
}

export function LoadAnexoDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: LoadAnexoDialogProps) {
  const [choices, setChoices] = useState<PrimariaElectiveChoices>(DEFAULT_PRIMARIA_ELECTIVES);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restaurar Anexo IV — Primaria</DialogTitle>
          <DialogDescription>
            Elige la opción activa en cada grupo «Elegir una». La otra quedará a 0 h (editable
            después). Por defecto en Asturias: Lengua Asturiana y Religión.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Lengua Asturiana / Cultura Asturiana (3 h)</Label>
            <Select
              value={choices.asturias}
              onValueChange={(v: PrimariaElectiveChoices["asturias"]) =>
                setChoices((c) => ({ ...c, asturias: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lengua_asturiana">Lengua Asturiana y Literatura</SelectItem>
                <SelectItem value="cultura_asturiana">Cultura Asturiana</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Religión / Atención educativa (2 h)</Label>
            <Select
              value={choices.religion}
              onValueChange={(v: PrimariaElectiveChoices["religion"]) =>
                setChoices((c) => ({ ...c, religion: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="religion">Religión</SelectItem>
                <SelectItem value="atencion_educativa">Atención educativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(choices)}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Restaurar plantilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
