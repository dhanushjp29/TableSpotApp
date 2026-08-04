function Input({
  label,
  error,
  hint,
  id,
  className = "",
  ...props
}) {
  const inputId = id || props.name;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input-field ${error ? "border-error focus:border-error focus:ring-error" : ""} ${className}`}
        aria-invalid={error ? "true" : "false"}
        {...props}
      />
      {error && <p className="input-error" role="alert">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default Input;
