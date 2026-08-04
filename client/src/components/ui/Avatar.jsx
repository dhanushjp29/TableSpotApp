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
        className={`rounded-full object-cover ${className}`}
        style={styleSize}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold ${className}`}
      style={styleSize}
      aria-label={`${user?.fullName || "User"} avatar`}
    >
      <span className="text-sm">{initials}</span>
    </div>
  );
}

export default Avatar;
