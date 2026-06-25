"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function WelcomeDialog({
  open,
  onStart,
  onExplore,
}: {
  open: boolean;
  onStart: () => void;
  onExplore: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onExplore()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Empezar la configuración guiada?</DialogTitle>
          <DialogDescription>
            Te mostraremos los 7 pasos para configurar tu colegio y generar el primer horario.
            Puedes relanzar la guía en cualquier momento desde el menú lateral.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onExplore}>
            Explorar por mi cuenta
          </Button>
          <Button onClick={onStart}>Empezar guía</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
