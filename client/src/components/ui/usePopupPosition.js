import { useLayoutEffect, useRef, useState } from "react";

export function usePopupPosition(open, popupWidth = 280, popupHeight = 320) {
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const [style, setStyle] = useState({ top: 0, left: 0, maxHeight: popupHeight });

  useLayoutEffect(() => {
    if (!open) return;

    const compute = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;

      let left = rect.left;
      if (left + popupWidth > vw - 8) left = Math.max(8, vw - popupWidth - 8);

      const below = vh - (rect.bottom + 4);
      if (below >= 120 || rect.top < 120) {
      const next = { top: rect.bottom + 4, left, maxHeight: Math.max(80, below - 4) };
      setStyle((current) => current.top === next.top && current.left === next.left && current.maxHeight === next.maxHeight ? current : next);
        return;
      }

      const spaceAbove = rect.top - 8;
      const maxHeight = Math.min(popupHeight, spaceAbove);
      const next = { top: rect.top - maxHeight - 4, left, maxHeight };
      setStyle((current) => current.top === next.top && current.left === next.left && current.maxHeight === next.maxHeight ? current : next);
    };

    compute();
    const frame = requestAnimationFrame(compute);

    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open, popupWidth, popupHeight]);

  return { triggerRef, popupRef, popupStyle: style };
}
