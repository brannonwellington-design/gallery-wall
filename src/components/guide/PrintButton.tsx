"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer size={14} strokeWidth={1.25} aria-hidden="true" />
      Print or save as PDF
    </Button>
  );
}
