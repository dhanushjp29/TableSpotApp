// Drop-in "Download PDF" button. Fetches the data, renders the light-mode PDF
// document off-screen, and downloads it via the shared generator.

import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Download } from "lucide-react";
import toast from "react-hot-toast";

import Button from "../ui/Button.jsx";
import { renderPdfBlob, downloadBlob, PDF_RENDER_WIDTH } from "../../utils/pdf/pdfGenerator.js";
import { useDownloadLoader } from "../../hooks/useDownloadLoader.js";

const RENDER_SETTLE_MS = 300;

export default function PdfDownloadButton({
  filename,
  fetchData,
  renderDocument,
  variant = "outline",
  size = "sm",
  label = "Download PDF",
  loadingLabel = "Generating...",
  successMessage = "PDF downloaded.",
  errorMessage = "Unable to generate the PDF.",
  disabled = false,
  className = "",
}) {
  const [isBusy, setIsBusy] = useState(false);
  const rootIdRef = useRef(null);
  const { isDownloading, runDownload } = useDownloadLoader();

  const handleClick = async () => {
    if (isBusy || isDownloading) return;
    setIsBusy(true);

    try {
      await runDownload(async () => {
        let wrapper = null;
        let root = null;

        try {
          const data = await fetchData();
          const fileName =
            typeof filename === "function" ? filename(data) : filename;

          const rootId =
            rootIdRef.current ||
            `tablespot-pdf-root-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          rootIdRef.current = rootId;

          document.getElementById(rootId)?.remove();

          wrapper = document.createElement("div");
          wrapper.id = rootId;
          wrapper.style.position = "absolute";
          wrapper.style.left = "-10000px";
          wrapper.style.top = "0";
          wrapper.style.width = `${PDF_RENDER_WIDTH}px`;
          wrapper.style.pointerEvents = "none";
          document.body.appendChild(wrapper);

          root = createRoot(wrapper);
          root.render(renderDocument(data));
          await new Promise((resolve) => setTimeout(resolve, RENDER_SETTLE_MS));

          const element = wrapper.firstElementChild;
          if (!element) throw new Error("PDF content did not render.");

          const blob = await renderPdfBlob({ element, filename: fileName });
          downloadBlob(blob, fileName);
          toast.success(successMessage);
        } catch (err) {
          console.error("[PdfDownloadButton]", err);
          toast.error(errorMessage);
        } finally {
          if (root) {
            try {
              root.unmount();
            } catch {
              // no-op
            }
          }
          if (wrapper) wrapper.remove();
        }
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || isBusy || isDownloading}
      className={className}
    >
      <Download size={14} className="mr-1" aria-hidden="true" />
      {isBusy ? loadingLabel : label}
    </Button>
  );
}
