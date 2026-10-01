"use client";

import { useCallback, useEffect, useRef, useState, useId } from "react";
import { ShieldAlert } from "lucide-react";

/** Awaitable confirmation that retains the cancel-before-mutation contract. */
export function useConfirmDialog() {
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pending = useRef<((confirmed: boolean) => void) | null>(null);
  const messageId = useId();

  const finish = useCallback((confirmed: boolean) => {
    pending.current?.(confirmed);
    pending.current = null;
    dialogRef.current?.close();
    setMessage(null);
  }, []);

  useEffect(() => {
    if (message !== null && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [message]);

  useEffect(() => () => {
    pending.current?.(false);
    pending.current = null;
  }, []);

  const confirm = useCallback((text: string) => new Promise<boolean>((resolve) => {
    pending.current?.(false);
    pending.current = resolve;
    setMessage(text);
  }), []);

  const confirmationDialog = message !== null ? (
    <dialog
      ref={dialogRef}
      aria-label="Confirm action"
      aria-describedby={messageId}
      onCancel={(event) => { event.preventDefault(); finish(false); }}
      onClick={(event) => { if (event.target === event.currentTarget) finish(false); }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-900 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
    >
      <div className="flex items-center gap-2 text-sm font-bold">
        <ShieldAlert className="size-5 shrink-0 text-orange-500" /> Confirm action
      </div>
      <p id={messageId} className="my-4 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{message}</p>
      <div className="flex justify-end gap-2">
        <button autoFocus type="button" onClick={() => finish(false)} className="min-h-11 rounded-xl border border-neutral-200 px-4 text-xs font-semibold dark:border-neutral-700">Cancel</button>
        <button type="button" onClick={() => finish(true)} className="min-h-11 rounded-xl bg-orange-500 px-4 text-xs font-semibold text-white hover:bg-orange-600">Confirm</button>
      </div>
    </dialog>
  ) : null;

  return { confirm, confirmationDialog };
}
