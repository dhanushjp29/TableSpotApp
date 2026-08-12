function Input({
  label,
  error,
  hint,
  id,
  className = "",
  leftIcon,
  rightIcon,
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
      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={`input-field ${leftIcon ? "pl-10" : ""} ${rightIcon ? "pr-11" : ""} ${error ? "border-error focus:border-error focus:ring-error" : ""} ${className}`}
          aria-invalid={error ? "true" : "false"}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {rightIcon}
          </span>
        )}
      </div>
      {error && <p className="input-error" role="alert">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default Input;
