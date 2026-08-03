const generateCode = async (Model, fieldName, prefix) => {
  const latestDocument = await Model.findOne()
    .sort({ createdAt: -1 })
    .select(fieldName);

  let nextNumber = 1;

  if (latestDocument && latestDocument[fieldName]) {
    const numericPart = latestDocument[fieldName].replace(prefix, "");

    nextNumber = Number(numericPart) + 1;
  }

  return `${prefix}${String(nextNumber).padStart(6, "0")}`;
};

export default generateCode;
