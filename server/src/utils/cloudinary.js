import { v2 as cloudinary } from "cloudinary";

import ApiError from "./ApiError.js";

const getCloudinaryConfig = () => {
  const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
  } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return null;
  }

  return {
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  };
};

const ensureCloudinaryConfig = () => {
  const config = getCloudinaryConfig();

  if (!config) {
    throw new ApiError(
      500,
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/src/.env"
    );
  }

  cloudinary.config(config);
};

const uploadBufferToCloudinary = ({
  buffer,
  folder = "tablespot",
  publicId = "",
  resourceType = "image",
  transformation = [],
}) => {
  return new Promise((resolve, reject) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      reject(new ApiError(400, "Image buffer is required."));
      return;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId || undefined,
        resource_type: resourceType,
        transformation,
      },
      (error, result) => {
        if (error) {
          reject(new ApiError(500, "Failed to upload image."));
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

export const uploadImage = async ({
  buffer,
  folder = "tablespot",
  publicId = "",
  transformation = [],
}) => {
  ensureCloudinaryConfig();

  const result = await uploadBufferToCloudinary({
    buffer,
    folder,
    publicId,
    transformation,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  };
};

export const uploadImages = async ({
  files = [],
  folder = "tablespot",
}) => {
  const results = await Promise.all(
    files.map((file) =>
      uploadImage({
        buffer: file.buffer,
        folder,
      })
    )
  );

  return results;
};

export const deleteImage = async (publicId) => {
  if (!publicId) {
    throw new ApiError(400, "Public ID is required.");
  }

  ensureCloudinaryConfig();

  const result = await cloudinary.uploader.destroy(publicId);

  return result;
};

export default cloudinary;
