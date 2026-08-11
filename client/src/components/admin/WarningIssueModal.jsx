import { useState } from "react";
import toast from "react-hot-toast";
import { useDispatch } from "react-redux";
import { AlertTriangle } from "lucide-react";

import { issueWarning } from "../../store/slices/reportSlice.js";

import Button from "../ui/Button.jsx";
import Modal from "../ui/Modal.jsx";

function WarningForm({ onClose, restaurant, relatedReportId, onIssued }) {
  const dispatch = useDispatch();
  const [level, setLevel] = useState("Level 1");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please provide a reason for the warning.");
      return;
    }
    setIsSubmitting(true);
    try {
      await dispatch(
        issueWarning({
          restaurantId:
            restaurant?._id ||
            relatedReportId?.restaurantId?._id ||
            (typeof relatedReportId?.restaurantId === "string"
              ? relatedReportId.restaurantId
              : undefined),
          level,
          title: title.trim() || "Platform warning",
          reason: reason.trim(),
          expiresInDays,
          ...(relatedReportId ? { relatedReportId: relatedReportId._id } : {}),
        })
      );
      toast.success("Warning issued.");
      onIssued();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to issue warning.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
      <div>
        <label className="mb-2 block text-sm font-medium text-text">
          Warning Level
        </label>
        <div className="flex flex-wrap gap-2">
          {["Level 1", "Level 2", "Final Warning"].map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setLevel(lv)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                level === lv
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-muted/30 text-muted hover:border-primary/40 hover:text-text"
              }`}
            >
              {lv}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="e.g. Hygiene standards violation"
          className="input-field w-full"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-text">
          Reason <span className="text-error">*</span>
        </label>
        <textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          placeholder="Describe the violation or issue that led to this warning..."
          className="input-field w-full"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">
          Validity (days)
        </label>
        <input
          type="number"
          min={1}
          max={365}
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(Number(e.target.value))}
          className="input-field w-full"
        />
        <p className="mt-1 text-xs text-muted">
          The warning auto-expires after this period.
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          <AlertTriangle size={15} className="mr-1" /> Issue Warning
        </Button>
      </div>
    </form>
  );
}

export default function WarningIssueModal({
  isOpen,
  onClose,
  restaurant,
  relatedReportId = null,
  onIssued,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Issue Warning — ${
        restaurant?.restaurantName || relatedReportId?.restaurantId?.restaurantName || "Restaurant"
      }`}
    >
      {isOpen && (
        <WarningForm
          key={String(isOpen)}
          onClose={onClose}
          restaurant={restaurant}
          relatedReportId={relatedReportId}
          onIssued={onIssued}
        />
      )}
    </Modal>
  );
}