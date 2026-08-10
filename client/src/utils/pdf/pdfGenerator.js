// Light-mode PDF rendering helpers built on top of html2pdf.js.
// PDFs are always rendered with a white background and dark text, regardless
// of the app's active theme, so every generated document stays print-ready.

export const PDF_RENDER_WIDTH = 794;

let html2pdfModulePromise = null;

const loadHtml2pdf = async () => {
  if (!html2pdfModulePromise) {
    html2pdfModulePromise = import("html2pdf.js").then(
      (module) => module.default?.default || module.default || module
    );
  }
  return html2pdfModulePromise;
};

/**
 * Render a DOM element (already laid out in light mode) into a PDF blob.
 * The element is cloned and moved off-screen, so the live UI is untouched.
 * The `element` may be re-rendered inside a hidden container before calling
 * this; width is normalised to a fixed A4-friendly pixel width.
 */
export async function renderPdfBlob({ element, filename }) {
  if (!element) {
    throw new Error("PDF content is not ready.");
  }

  const renderElement = element.cloneNode(true);
  renderElement.removeAttribute("id");
  renderElement.style.width = "100%";

  const renderWrapper = document.createElement("div");
  renderWrapper.style.position = "absolute";
  renderWrapper.style.left = "-10000px";
  renderWrapper.style.top = "0";
  renderWrapper.style.width = `${PDF_RENDER_WIDTH}px`;
  renderWrapper.style.pointerEvents = "none";
  renderWrapper.appendChild(renderElement);
  document.body.appendChild(renderWrapper);

  const html2pdf = await loadHtml2pdf();
  try {
    return await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        backgroundColor: "#ffffff",
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr"] },
      })
      .from(renderElement)
      .toPdf()
      .output("blob");
  } finally {
    renderWrapper.remove();
  }
}

/** Trigger a browser download for a generated PDF blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Convenience wrapper: render `element` and download the resulting PDF.
 */
export async function generatePdf({ element, filename }) {
  const blob = await renderPdfBlob({ element, filename });
  downloadBlob(blob, filename);
  return blob;
}
