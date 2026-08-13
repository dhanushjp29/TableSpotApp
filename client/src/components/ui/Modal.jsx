import { X } from "lucide-react";
import { useEffect } from "react";

function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  footer,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Modal"}
    >
      <div
        className={`modal-panel w-full ${sizeClasses[size]} flex max-h-[90vh] flex-col rounded-3xl border border-border bg-surface/95 shadow-2xl ring-1 ring-black/5 dark:bg-surface/90 dark:ring-white/5`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border bg-surface-secondary/35 px-4 py-4 sm:px-6">
            <h2 className="text-lg font-bold tracking-tight text-text">{title}</h2>
            <button
              onClick={onClose}
              className="icon-btn"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-3 border-t border-border bg-surface-secondary/25 px-4 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
