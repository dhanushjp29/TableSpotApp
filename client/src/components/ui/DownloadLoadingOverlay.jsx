import { DotLottieReact } from "@lottiefiles/dotlottie-react";

import { useDownloadLoader } from "../../hooks/useDownloadLoader.js";

/**
 * Full-screen overlay shown while a PDF/Excel download is being prepared.
 *
 * The DotLottie component stays permanently mounted and autoplays from app
 * startup, so the animation is already initialized and looping before any
 * download begins. The overlay only toggles its own visibility via
 * opacity/visibility/pointer-events; the Lottie instance is never recreated.
 */
export default function DownloadLoadingOverlay() {
  const { isDownloading } = useDownloadLoader();

  return (
    <div
      className="download-loader-overlay fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4"
      data-visible={isDownloading}
      aria-busy={isDownloading}
      aria-hidden={!isDownloading}
      role="status"
      aria-live="polite"
    >
      <div className="download-loader-card flex flex-col items-center rounded-3xl px-8 py-7 sm:px-10 sm:py-8">
        <div className="h-40 w-40 sm:h-48 sm:w-48">
          <DotLottieReact
            src="/loading.lottie"
            loop
            autoplay
            className="h-full w-full"
          />
        </div>
        <p className="mt-4 text-sm font-semibold tracking-wide text-text sm:text-base">
          Preparing your download...
        </p>
      </div>
    </div>
  );
}
