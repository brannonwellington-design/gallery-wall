"use client";

import type Konva from "konva";
import type { RefObject } from "react";

/** PNG and PDF export of the wall canvas, named after the room. */
export function useWallExport(stageRef: RefObject<Konva.Stage | null>, name: string) {
  function exportPNG() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${slug(name)}.png`;
    a.click();
  }

  async function exportPDF() {
    const stage = stageRef.current;
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const { jsPDF } = await import("jspdf");
    const w = stage.width();
    const h = stage.height();
    const orientation = w >= h ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "pt", format: [w, h] });
    pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
    pdf.save(`${slug(name)}.pdf`);
  }

  return { exportPNG, exportPDF };
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "gallery-wall"
  );
}
