// Three-way merge of a room: `base` is the version both sides started from,
// `local` is this editor's copy, `server` is what someone else saved. Edits to
// different pieces (or different fields of the same piece) combine cleanly;
// only when both sides changed the same field does local win. Used instead of
// blocking with "Out of date" when two people edit the same wall.

import type { Fixture, Item, Room } from "./types";

type WithId = { id: string };

/** JSON with object keys sorted, so key order (editor vs. server) doesn't matter. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      // null and missing both mean "no value" (e.g. frame, original image).
      .filter((k) => (v as Record<string, unknown>)[k] != null)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "undefined";
}

const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/** Field-by-field merge of one object; local wins where both changed a field. */
function mergeFields<T extends object>(base: T, local: T, server: T): T {
  const out = { ...server } as Record<string, unknown>;
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(server)]);
  for (const k of keys) {
    const b = (base as Record<string, unknown>)[k];
    const l = (local as Record<string, unknown>)[k];
    if (!same(l, b)) {
      if (l === undefined) delete out[k];
      else out[k] = l;
    }
  }
  return out as T;
}

export type MergeReport = {
  /** Pieces/fixtures both sides changed; local values were kept for overlapping fields. */
  conflicts: number;
};

/**
 * Merge lists keyed by id (pieces, fixtures). Server order first, then
 * anything only this editor added. A deletion loses to an edit on the
 * other side, so nobody's work silently disappears.
 */
function mergeById<T extends WithId>(base: T[], local: T[], server: T[], report: MergeReport): T[] {
  const b = new Map(base.map((x) => [x.id, x]));
  const l = new Map(local.map((x) => [x.id, x]));
  const s = new Map(server.map((x) => [x.id, x]));
  const out: T[] = [];
  const order = [...server.map((x) => x.id), ...local.map((x) => x.id).filter((id) => !s.has(id))];

  for (const id of order) {
    const bi = b.get(id);
    const li = l.get(id);
    const si = s.get(id);
    if (!bi) {
      // Added on one side (or, rarely, both): keep it.
      if (li && si) out.push(same(li, si) ? si : li);
      else out.push((li ?? si)!);
      continue;
    }
    if (!li && !si) continue; // deleted on both sides
    if (!li) {
      // Deleted here: honour it unless the other side has since edited it.
      if (si && !same(si, bi)) out.push(si);
      continue;
    }
    if (!si) {
      // Deleted there: honour it unless this editor has edited it.
      if (!same(li, bi)) out.push(li);
      continue;
    }
    const localChanged = !same(li, bi);
    const serverChanged = !same(si, bi);
    if (localChanged && serverChanged && !same(li, si)) report.conflicts++;
    out.push(!localChanged ? si : !serverChanged ? li : mergeFields(bi, li, si));
  }
  return out;
}

export function mergeRooms(base: Room, local: Room, server: Room): { room: Room; report: MergeReport } {
  const report: MergeReport = { conflicts: 0 };
  const { items: bItems, fixtures: bFix, ...bRest } = base;
  const { items: lItems, fixtures: lFix, ...lRest } = local;
  const { items: sItems, fixtures: sFix, ...sRest } = server;
  const room = {
    ...mergeFields(bRest, lRest, sRest),
    items: mergeById<Item>(bItems, lItems, sItems, report),
    fixtures: mergeById<Fixture>(bFix ?? [], lFix ?? [], sFix ?? [], report),
  } as Room;
  if (!base.fixtures && !local.fixtures && !server.fixtures) delete room.fixtures;
  return { room, report };
}
