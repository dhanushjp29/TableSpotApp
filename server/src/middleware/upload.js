import multer from "multer";

import ApiError from "../utils/ApiError.js";

const DEFAULT_MAX_FILE_SIZE =
  Number(process.env.MAX_FILE_SIZE_BYTES) || 5 * 1024 * 1024;

const DEFAULT_MAX_FILES =
  Number(process.env.MAX_UPLOAD_FILES) || 20;

// Keep uploads in memory so the service layer can stream to Cloudinary.
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    return cb(null, true);
  }

  return cb(
    new ApiError(400, "Only image uploads are allowed."),
    false
  );
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: DEFAULT_MAX_FILE_SIZE,
    files: DEFAULT_MAX_FILES,
  },
});

export const uploadSingle = (fieldName) => upload.single(fieldName);

export const uploadArray = (
  fieldName,
  maxCount = 10
) => upload.array(fieldName, maxCount);

export const uploadFields = (fields) => upload.fields(fields);

export const uploadAnyImages = () => upload.any();

export default upload;
