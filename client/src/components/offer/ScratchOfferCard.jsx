import { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Gift, Percent, Store, Ticket, Utensils } from "lucide-react";
import { formatOfferDiscount } from "../../constants/offer.js";

const SCRATCH_THRESHOLD = 55;
const DECORATIVE_ICONS = [Coins, Percent, Utensils, Gift, Ticket, Store];

function ScratchOfferCard({ offer, onClaim, claiming = false, claimError = "" }) {
  const canvasRef = useRef(null);
  const surfaceRef = useRef(null);
  const contextRef = useRef(null);
  const scratchingRef = useRef(false);
  const lastPointRef = useRef(null);
  const revealedRef = useRef(false);
  const checkFrameRef = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const [scratchPercent, setScratchPercent] = useState(0);

  const paintSurface = useCallback(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface || revealedRef.current) return;
    const rect = surface.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gradient = context.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, "#b71c1c");
    gradient.addColorStop(0.5, "#e53935");
    gradient.addColorStop(1, "#8e0000");
    context.globalCompositeOperation = "source-over";
    context.fillStyle = gradient;
    context.fillRect(0, 0, rect.width, rect.height);
    context.globalCompositeOperation = "destination-out";
    contextRef.current = context;
  }, []);

  const getScratchPercent = useCallback(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0;
    let samples = 0;
    for (let index = 3; index < pixels.length; index += 32) {
      samples += 1;
      if (pixels[index] < 32) transparent += 1;
    }
    return samples ? (transparent / samples) * 100 : 0;
  }, []);

  const finishScratch = useCallback(async () => {
    if (revealedRef.current || getScratchPercent() < SCRATCH_THRESHOLD) return;
    revealedRef.current = true;
    setScratchPercent(100);
    setRevealed(true);
    try {
      const result = await onClaim(offer);
      if (result === false) {
        revealedRef.current = false;
        setRevealed(false);
        setScratchPercent(0);
        paintSurface();
      }
    } catch {
      revealedRef.current = false;
      setRevealed(false);
      setScratchPercent(0);
      paintSurface();
    }
  }, [getScratchPercent, offer, onClaim, paintSurface]);

  const checkProgress = useCallback(() => {
    if (revealedRef.current) return;
    const percent = getScratchPercent();
    setScratchPercent(percent);
    if (percent >= SCRATCH_THRESHOLD) finishScratch();
  }, [finishScratch, getScratchPercent]);

  const scratch = (event) => {
    if (revealedRef.current || !contextRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const context = contextRef.current;
    context.lineWidth = 34;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(0,0,0,1)";
    context.beginPath();
    if (lastPointRef.current) {
      context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      context.lineTo(point.x, point.y);
      context.stroke();
    } else {
      context.arc(point.x, point.y, 17, 0, Math.PI * 2);
      context.fill();
    }
    lastPointRef.current = point;
    if (!checkFrameRef.current) {
      checkFrameRef.current = requestAnimationFrame(() => {
        checkFrameRef.current = null;
        checkProgress();
      });
    }
  };

  const handleKeyboardReveal = (event) => {
    if (revealedRef.current || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;
    context.save();
    context.resetTransform();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    finishScratch();
  };

  useEffect(() => {
    paintSurface();
    const resizeObserver = new ResizeObserver(paintSurface);
    if (surfaceRef.current) resizeObserver.observe(surfaceRef.current);
    return () => {
      resizeObserver.disconnect();
      if (checkFrameRef.current) cancelAnimationFrame(checkFrameRef.current);
    };
  }, [paintSurface]);

  const restaurant = offer?.restaurantId;
  const restaurantName = typeof restaurant === "object" ? restaurant?.restaurantName : "";
  const Icon = DECORATIVE_ICONS[String(offer?._id || "").length % DECORATIVE_ICONS.length];

  return (
    <article className="card-theme overflow-hidden border-primary/10 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative bg-surface px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">A little extra for your table</p>
            <h3 className="mt-2 text-xl font-extrabold tracking-tight text-text">Unlock your reward</h3>
          </div>
          <Ticket className="shrink-0 text-primary" size={22} aria-hidden="true" />
        </div>
        <div ref={surfaceRef} role="button" tabIndex={0} aria-label="Scratch to reveal offer. Press Enter or Space to reveal." onKeyDown={handleKeyboardReveal} className="scratch-offer-surface relative mt-5 min-h-44 overflow-hidden rounded-xl touch-none select-none" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); scratchingRef.current = true; lastPointRef.current = null; scratch(event); }} onPointerMove={(event) => { if (scratchingRef.current) { event.preventDefault(); scratch(event); } }} onPointerUp={() => { scratchingRef.current = false; lastPointRef.current = null; checkProgress(); }} onPointerCancel={() => { scratchingRef.current = false; lastPointRef.current = null; }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <h3 className="mb-2 text-xl font-extrabold tracking-tight text-primary">{offer?.title || "Special offer"}</h3>
            <p className="text-4xl font-black tracking-tight text-primary">{offer?.discountValue ? formatOfferDiscount(offer) : "A surprise inside"}</p>
            <p className="mt-2 max-w-[18rem] text-sm text-muted">{offer?.description || "Reveal this offer to unlock the details."}</p>
            {restaurantName && <p className="mt-3 text-xs font-semibold text-muted">{restaurantName}</p>}
          </div>
          <canvas ref={canvasRef} className={`absolute inset-0 z-20 cursor-crosshair transition-opacity duration-500 ${revealed ? "pointer-events-none opacity-0" : "opacity-100"}`} aria-hidden="true" />
          {!revealed && <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"><div className="scratch-offer-icons absolute inset-0" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((index) => { const DecorativeIcon = index === 0 ? Icon : DECORATIVE_ICONS[(index + String(offer?._id || "").length) % DECORATIVE_ICONS.length]; return <DecorativeIcon key={index} size={index % 2 ? 20 : 26} style={{ left: `${14 + ((index * 17) % 72)}%`, top: `${18 + ((index * 23) % 62)}%`, transform: `rotate(${index % 2 ? 12 : -10}deg)` }} />; })}</div><div className="text-center text-white drop-shadow-md"><p className="text-lg font-extrabold">Scratch to reveal</p><p className="mt-1 text-xs text-white/80">Drag across the card</p><span className="mt-3 inline-block rounded-full border border-white/45 bg-white/10 px-3 py-1 text-[11px] font-semibold">{Math.round(scratchPercent)}% revealed</span></div></div>}
        </div>
        <p className="mt-3 text-center text-xs text-muted">{claiming ? "Unlocking your offer…" : claimError || "Your offer unlocks after a little scratching."}</p>
      </div>
    </article>
  );
}

export default ScratchOfferCard;
