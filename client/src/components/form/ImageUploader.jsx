import { Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

function ImageUploader({
  label,
  value = [],
  onChange,
  min = 0,
  max = 10,
  single = false,
  description,
  error,
}) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const canAdd = value.length < max;

  const addFiles = (files) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, Math.max(0, max - value.length));

    const items = list.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    if (single) {
      value.forEach((item) => URL.revokeObjectURL(item.preview));
      onChange(items.slice(-1));
    } else {
      onChange([...value, ...items]);
    }
  };

  const removeAt = (index) => {
    const item = value[index];
    if (item?.preview) URL.revokeObjectURL(item.preview);
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      {label && <label className="input-label">{label}</label>}

      <div
        role="button"
        tabIndex={0}
        onClick={() => canAdd && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && canAdd) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (canAdd) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (canAdd) addFiles(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-gray-300 bg-surface hover:border-primary/60"
        } ${!canAdd ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={!single}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloud size={20} />
          </div>
          <p className="text-sm font-medium text-text">
            {single
              ? "Click to upload or drag & drop cover image"
              : "Click to upload or drag & drop images"}
          </p>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      </div>

      {value.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {value.map((item, index) => (
            <div
              key={`${item.preview}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200"
            >
              <img
                src={item.preview}
                alt={`${label || "Image"} ${index + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                aria-label="Remove image"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!single && min > 0 && (
        <p className="mt-1.5 text-xs text-muted">
          {value.length}/{max} selected{min > 0 ? ` · minimum ${min}` : ""}
        </p>
      )}

      {error && <p className="input-error">{error}</p>}
    </div>
  );
}

export default ImageUploader;
