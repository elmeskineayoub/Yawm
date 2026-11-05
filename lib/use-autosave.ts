"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action-result";
import { safeAction } from "@/lib/safe-action";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error" | "offline";

/**
 * Saves a value on its own after a short pause in typing, when the tab is hidden, when the
 * connection returns, or on demand (`flush`, e.g. on blur). The state it reports is honest:
 * "Saved" only after the server confirmed; "Offline — not saved yet" and errors keep the draft in
 * place so nothing is lost; leaving the page with unsaved changes asks first.
 *
 * `serialize` decides what counts as a change (e.g. trimmed text), so whitespace-only edits
 * don't trigger saves. `validate` can block a save that would fail anyway (e.g. an empty title)
 * and show why.
 */
export function useAutosave<T>({
  value,
  serialize,
  save,
  validate,
  delay = 1000,
}: {
  value: T;
  serialize: (value: T) => string;
  save: (value: T) => Promise<ActionResult<unknown>>;
  validate?: (value: T) => string | null;
  delay?: number;
}) {
  const [savedPayload, setSavedPayload] = useState(() => serialize(value));
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Latest values for the async save, written in effects so render never reads a ref.
  const valueRef = useRef(value);
  const savedRef = useRef(savedPayload);
  const saveRef = useRef(save);
  const serializeRef = useRef(serialize);
  const validateRef = useRef(validate);
  const savingRef = useRef(false);
  useEffect(() => {
    valueRef.current = value;
    saveRef.current = save;
    serializeRef.current = serialize;
    validateRef.current = validate;
  });
  useEffect(() => {
    savedRef.current = savedPayload;
  }, [savedPayload]);

  const payload = serialize(value);
  const dirty = payload !== savedPayload;

  const flush = useCallback(async () => {
    if (savingRef.current) return;
    const current = valueRef.current;
    const snapshot = serializeRef.current(current);
    if (snapshot === savedRef.current) return;
    const problem = validateRef.current?.(current) ?? null;
    if (problem) {
      setStatus("error");
      setError(problem);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }
    savingRef.current = true;
    setStatus("saving");
    const result = await safeAction(() => saveRef.current(current));
    savingRef.current = false;
    if (result.ok) {
      setSavedPayload(snapshot);
      setStatus("saved");
      setError(null);
    } else {
      setStatus(/offline/i.test(result.error) ? "offline" : "error");
      setError(result.error);
    }
  }, []);

  // Debounced save whenever the content changes. Depending on savedPayload reschedules a
  // follow-up save if typing continued while the previous save was in flight.
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => void flush(), delay);
    return () => clearTimeout(id);
  }, [payload, dirty, savedPayload, flush, delay]);

  // Retry when connectivity returns; save before the tab is hidden; warn before leaving with
  // changes the server hasn't confirmed.
  useEffect(() => {
    const onOnline = () => void flush();
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (serializeRef.current(valueRef.current) !== savedRef.current || savingRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flush]);

  let statusText = "";
  let isError = false;
  if (status === "saving") statusText = "Saving…";
  else if (status === "offline") {
    statusText = "Offline — not saved yet";
    isError = true;
  } else if (status === "error") {
    statusText = error ?? "Couldn't save";
    isError = true;
  } else if (dirty) statusText = "Unsaved changes…";
  else if (status === "saved") statusText = "Saved";

  return { status, statusText, isError, dirty, flush };
}
