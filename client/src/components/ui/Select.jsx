function Select({
  label,
  error,
  hint,
  id,
  children,
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
      <select
        id={inputId}
        className={`input-field ${error ? "border-error focus:border-error focus:ring-error" : ""} ${className}`}
        aria-invalid={error ? "true" : "false"}
        {...props}
      >
        {children}
      </select>
      {error && <p className="input-error" role="alert">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default Select;
