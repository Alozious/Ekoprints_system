import React, { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Explanations stay out of the layout and remain available to keyboard/touch users. */
export default function InfoTooltip({ children, label = 'Page information' }: { children: React.ReactNode; label?: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    const rect = button.current?.getBoundingClientRect();
    if (rect) setPosition({ left: Math.max(12, Math.min(rect.right - 352, window.innerWidth - 364)), top: rect.bottom + 8, above: window.innerHeight - rect.bottom < 260 });
  };
  const hideSoon = () => { timer.current = setTimeout(() => {
    if (document.activeElement !== button.current) setPosition(null);
  }, 180); };
  return <span className="inline-flex align-middle normal-case tracking-normal">
    <button ref={button} type="button" aria-label={label} aria-expanded={!!position} aria-describedby={position ? id : undefined}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 hover:border-yellow-400 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400"
      onPointerEnter={e => { if (e.pointerType !== 'touch') show(); }} onPointerLeave={hideSoon} onFocus={show} onBlur={hideSoon} onClick={show}
      onKeyDown={e => { if (e.key === 'Escape') { setPosition(null); button.current?.blur(); } }}>
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg>
    </button>
    {position && createPortal(<div id={id} role="tooltip" className="fixed z-[10000] w-[352px] max-w-[calc(100vw-24px)] max-h-[70vh] overflow-auto rounded-2xl bg-gray-900 p-4 text-left text-xs font-normal leading-relaxed text-white shadow-xl space-y-2"
      style={{ left: position.left, ...(position.above ? { bottom: window.innerHeight - (button.current?.getBoundingClientRect().top ?? 0) + 8 } : { top: position.top }) }}
      onPointerEnter={show} onPointerLeave={hideSoon}>{children}</div>, document.body)}
  </span>;
}
