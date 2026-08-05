export const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

export const formatDateTime = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
};

export const formatTime = (date) => {
  if (!date) return "";

  // Support "HH:MM" / "HH:MM:SS" strings (e.g. bookingTime form values)
  if (typeof date === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(date)) {
    const [hours, minutes] = date.split(":").map(Number);
    const parsed = new Date();
    parsed.setHours(hours, minutes, 0, 0);
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(parsed);
  }

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
};
