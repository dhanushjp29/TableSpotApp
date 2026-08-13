import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import toast from "react-hot-toast";

import { restaurantReportApi } from "../../api/report.api.js";
import { uploadApi } from "../../api/upload.api.js";
import Button from "./Button.jsx";
import Modal from "./Modal.jsx";

const CATEGORIES = [
  "Food Quality",
  "Hygiene",
  "Wrong Billing",
  "Staff Behaviour",
  "Service Delay",
  "Fake Information",
  "Safety Issue",
  "Other",
];

const SEVERITIES = ["Low", "Medium", "High"];

function ReportForm({ onClose, restaurantId, restaurantName, onSuccess }) {
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("Medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!category) {
      toast.error("Please select a category.");
      return;
    }
    if (description.trim().length < 20) {
      toast.error("Description must be at least 20 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadedImages = [];
      if (imageFile) {
        setIsUploading(true);
        const uploaded = await uploadApi.image(imageFile);
        const url = uploaded?.url || uploaded?.secure_url || uploaded;
        if (url) uploadedImages = [url];
      }

      await restaurantReportApi.create({
        restaurantId,
        category,
        severity,
        title,
        description: description.trim(),
        images: uploadedImages,
      });

      toast.success("Report submitted. Our team will review it shortly.");
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit report.");
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-2">
      <div>
        <label className="mb-2 block text-sm font-medium text-text">
          Category <span className="text-error">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                category === cat
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-muted/30 text-muted hover:border-primary/40 hover:text-text"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-text">
          Severity
        </label>
        <div className="flex flex-wrap gap-2">
          {SEVERITIES.map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverity(sev)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                severity === sev
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-muted/30 text-muted hover:border-primary/40 hover:text-text"
              }`}
            >
              {sev}
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
          maxLength={150}
          placeholder="Short summary (optional)"
          className="input-field w-full"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">
          Description <span className="text-error">*</span>
        </label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          placeholder={`What happened at ${restaurantName}? (20+ characters)`}
          className="input-field w-full"
        />
        <p className="mt-1 text-right text-xs text-muted">
          {description.length}/1000
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-text">
          Evidence photo (optional)
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Evidence preview"
                className="h-20 w-20 rounded-lg border border-border object-cover"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-white shadow"
                aria-label="Remove photo"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary"
              >
                <ImagePlus size={20} />
                <span className="text-[10px] font-medium">Add photo</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting || isUploading}>
          Submit Report
        </Button>
      </div>
    </form>
  );
}

export default function ReportModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantName = "",
  onSuccess,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report a Restaurant">
      {isOpen && (
        <ReportForm
          onClose={onClose}
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          onSuccess={onSuccess}
        />
      )}
    </Modal>
  );
}