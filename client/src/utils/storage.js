const PREFIX = "tablespot_";

export const storage = {
  get(key) {
    try {
      const value = localStorage.getItem(PREFIX + key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      // Ignore storage errors
    }
  },

  clear() {
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(PREFIX))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore storage errors
    }
  },
};
