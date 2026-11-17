"use client";

import { useState } from "react";
import { initials, type PresenceEntry } from "@/lib/presence";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const MAX_SHOWN = 4;

/**
 * Who else is in this room: one colored avatar per open editor, plus a
 * "You" chip to set the name others see.
 */
export default function PresenceBar({
  others,
  name,
  onRename,
}: {
  others: PresenceEntry[];
  name: string;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const shown = others.slice(0, MAX_SHOWN);
  const extra = others.length - shown.length;

  return (
    <div className="flex items-center gap-2" aria-label="People in this room">
      {others.length > 0 ? (
        <div className="flex -space-x-1.5">
          {shown.map((p) => (
            <Tooltip key={p.sessionId}>
              <TooltipTrigger asChild>
                <span
                  className="flex size-6 items-center justify-center rounded-full border-2 border-surface-primary text-caption text-white"
                  style={{ backgroundColor: p.color }}
                  aria-label={p.name}
                >
                  {initials(p.name)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {p.name} is here
                {p.selection.length > 0
                  ? ` · ${p.selection.length} ${p.selection.length === 1 ? "piece" : "pieces"} selected`
                  : ""}
              </TooltipContent>
            </Tooltip>
          ))}
          {extra > 0 ? (
            <span className="flex size-6 items-center justify-center rounded-full border-2 border-surface-primary bg-surface-tertiary text-caption text-content-primary">
              +{extra}
            </span>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <input
          autoFocus
          onFocus={(e) => e.target.select()}
          value={draft}
          maxLength={40}
          aria-label="Your name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onRename(draft);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="h-6 w-28 rounded-md border border-surface-tertiary bg-surface-primary px-1.5 text-label text-content-primary"
        />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                setDraft(name);
                setEditing(true);
              }}
              className="h-6 rounded-md px-1.5 text-label text-content-disabled hover:bg-surface-secondary hover:text-content-primary"
            >
              {others.length > 0 ? `You (${name})` : name === "Guest" ? "Set your name" : name}
            </button>
          </TooltipTrigger>
          <TooltipContent>The name other people in this room see</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
