"use client";

import { useCallback, useRef, useState } from "react";

// History-aware state container. Drop-in for useState; every set adds the
// previous value to an undo stack. Rapid consecutive sets within
// COALESCE_WINDOW_MS are treated as one undoable step — so dragging the
// frame-color picker, for instance, becomes a single Undo.
//
// undo/redo navigate the stack; any new set clears the redo stack.

type Updater<T> = T | ((prev: T) => T);

type Frame<T> = {
  past: T[];
  present: T;
  future: T[];
};

const MAX_STACK = 20;
const COALESCE_WINDOW_MS = 400;

export type UseHistoryReturn<T> = {
  state: T;
  /** Replaces the present state and pushes the prior present to the undo stack (with coalescing). */
  setState: (next: Updater<T>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function useHistory<T>(initial: T): UseHistoryReturn<T> {
  const [frame, setFrame] = useState<Frame<T>>({
    past: [],
    present: initial,
    future: [],
  });
  // Time of the last set. When the next set arrives inside the coalesce
  // window we keep `past` the same — the snapshot already on the stack
  // represents the start of the current gesture.
  const lastPushAt = useRef<number>(0);

  const setState = useCallback((next: Updater<T>) => {
    setFrame((f) => {
      const nextVal =
        typeof next === "function" ? (next as (p: T) => T)(f.present) : next;
      if (Object.is(nextVal, f.present)) return f;
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const coalesce = now - lastPushAt.current < COALESCE_WINDOW_MS;
      lastPushAt.current = now;
      const past = coalesce
        ? f.past
        : [...f.past, f.present].slice(-MAX_STACK);
      return { past, present: nextVal, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setFrame((f) => {
      if (f.past.length === 0) return f;
      const prev = f.past[f.past.length - 1];
      lastPushAt.current = 0; // reset coalescing — next edit is a new gesture
      return {
        past: f.past.slice(0, -1),
        present: prev,
        future: [f.present, ...f.future].slice(0, MAX_STACK),
      };
    });
  }, []);

  const redo = useCallback(() => {
    setFrame((f) => {
      if (f.future.length === 0) return f;
      const [next, ...rest] = f.future;
      lastPushAt.current = 0;
      return {
        past: [...f.past, f.present].slice(-MAX_STACK),
        present: next,
        future: rest,
      };
    });
  }, []);

  return {
    state: frame.present,
    setState,
    undo,
    redo,
    canUndo: frame.past.length > 0,
    canRedo: frame.future.length > 0,
  };
}
