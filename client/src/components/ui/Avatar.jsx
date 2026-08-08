function Avatar({ user, size = 40, className = "" }) {
  const initials = (user?.fullName || user?.name || "?")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const styleSize = { width: size, height: size };

  if (user?.profileImage) {
    return (
      <img
        src={user.profileImage}
        alt={`${user.fullName || "User"} avatar`}
        className={`rounded-full object-cover ring-1 ring-border/60 ${className}`}
        style={styleSize}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full border border-primary/15 bg-primary/10 font-semibold text-primary shadow-sm ${className}`}
      style={styleSize}
      aria-label={`${user?.fullName || "User"} avatar`}
    >
      <span className={size >= 44 ? "text-sm" : "text-[11px]"}>{initials}</span>
    </div>
  );
}

export default Avatar;
