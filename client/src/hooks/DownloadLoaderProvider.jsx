import { useCallback, useRef, useState } from "react";

import { DownloadLoaderContext } from "./useDownloadLoader.js";

/** Give the browser one paint opportunity so the overlay is visible before heavy
 *  PDF/Excel generation blocks the main thread. */
const waitForPaint = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    } else {
      setTimeout(resolve, 0);
    }
  });

/**
 * Shared full-screen download-processing overlay.
 *
 * Only one overlay exists and only one download can run at a time:
 *  - startDownload() guards against duplicate clicks via a synchronous ref.
 *  - runDownload(task) shows the overlay, yields one paint, runs the task,
 *    and always hides the overlay again (success or failure).
 */
export default function DownloadLoaderProvider({ children }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const activeRef = useRef(false);

  const startDownload = useCallback(() => {
    if (activeRef.current) return false;
    activeRef.current = true;
    setIsDownloading(true);
    return true;
  }, []);

  const finishDownload = useCallback(() => {
    activeRef.current = false;
    setIsDownloading(false);
  }, []);

  const runDownload = useCallback(
    async (task) => {
      if (!startDownload()) return;
      await waitForPaint();
      try {
        await task();
      } finally {
        finishDownload();
      }
    },
    [startDownload, finishDownload]
  );

  const value = { isDownloading, startDownload, finishDownload, runDownload };

  return (
    <DownloadLoaderContext.Provider value={value}>
      {children}
    </DownloadLoaderContext.Provider>
  );
}
