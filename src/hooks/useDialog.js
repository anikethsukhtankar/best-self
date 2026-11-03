import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])';

// A modal dialog's keyboard: focus moves in when it opens (to `focusRef`) and back to where it was
// when it closes; Tab and Shift+Tab stay inside it, never reaching the page behind the overlay;
// Escape calls `onEscape`, and is marked handled so the page behind leaves it alone.
export function useDialog(dialogRef, focusRef, onEscape) {
  const escape = useRef(onEscape);
  useEffect(() => { escape.current = onEscape; });
  useEffect(() => {
    const before = document.activeElement;
    (focusRef.current || dialogRef.current)?.focus();
    const onKey = (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); escape.current(); return; }
      const dialog = dialogRef.current;
      if (ev.key !== 'Tab' || !dialog) return;
      const stops = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const at = document.activeElement;
      const inside = dialog.contains(at);
      if (ev.shiftKey && (at === first || !inside)) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && (at === last || !inside)) { ev.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [dialogRef, focusRef]);
}
