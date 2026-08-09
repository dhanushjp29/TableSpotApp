import { useEffect, useRef, useState } from "react";

export function usePopupPosition(open, popupWidth = 280, popupHeight = 320) {
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  const [style, setStyle] = useState({ top: 0, left: 0, maxHeight: popupHeight });

  useEffect(() => {
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
        setStyle({ top: rect.bottom + 4, left, maxHeight: Math.max(80, below - 4) });
        return;
      }

      const spaceAbove = rect.top - 8;
      const maxHeight = Math.min(popupHeight, spaceAbove);
      setStyle({ top: rect.top - maxHeight - 4, left, maxHeight });
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
