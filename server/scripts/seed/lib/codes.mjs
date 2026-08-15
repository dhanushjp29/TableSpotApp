const pad6 = (n) => String(n).padStart(6, "0");

const codeFor = (prefix, index) => `${prefix}${pad6(index)}`;

const numericSuffix = (code) => {
  const match = String(code || "").match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
};

export { codeFor, numericSuffix };
