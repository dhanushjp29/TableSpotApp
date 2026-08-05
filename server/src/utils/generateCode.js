const generateCode = async (Model, fieldName, prefix) => {
  const docs = await Model.find({}, { [fieldName]: 1 }).lean();

  let max = 0;
  for (const doc of docs) {
    const code = doc[fieldName];
    if (typeof code !== "string" || !code.startsWith(prefix)) continue;

    const numericPart = code.slice(prefix.length);
    const parsed = Number(numericPart);

    if (Number.isInteger(parsed) && parsed >= 0 && parsed > max) {
      max = parsed;
    }
  }

  return `${prefix}${String(max + 1).padStart(6, "0")}`;
};

export default generateCode;
