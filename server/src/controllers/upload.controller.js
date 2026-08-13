import ApiError from "../utils/ApiError.js";
import { uploadImage as cloudUploadImage } from "../utils/cloudinary.js";

export const uploadImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      throw new ApiError(400, "Image file is required.");
    }

    const result = await cloudUploadImage({ buffer: req.file.buffer });

    return res.json({ data: result, message: "Image uploaded successfully." });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message || "Upload failed." });
  }
};

export default {
  uploadImage,
};
