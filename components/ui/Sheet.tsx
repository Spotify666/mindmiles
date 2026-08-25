'use client';

import { useEffect, useRef } from 'react';

/**
 * A bottom sheet.
 *
 * Mobile-first in the literal sense: it enters from the bottom edge, its
 * dismiss control sits inside thumb reach rather than in the top-right corner,
 * and it can be scrolled without moving the page behind it.
 *
 * It is a real modal — focus is trapped, Escape closes it, and the background
 * is inert while it is open.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-fade-up relative max-h-[86svh] w-full overflow-y-auto rounded-t-[22px] border border-hair bg-surface sm:max-w-[520px] sm:rounded-card"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-hair bg-surface/95 px-5 py-4 backdrop-blur">
          <h2 className="text-[17px] font-[620] tracking-tightest">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-pill border border-hair px-3 py-1.5 text-[13px] text-chalk-70 transition-colors hover:bg-surface-inset hover:text-chalk"
          >
            Close
          </button>
        </div>
        <div className="safe-b px-5 pb-8 pt-5">{children}</div>
      </div>
    </div>
  );
}
