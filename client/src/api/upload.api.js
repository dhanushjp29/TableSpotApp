import apiClient from "./apiClient.js";

export const uploadApi = {
  async image(file) {
    const form = new FormData();
    form.append("image", file);

    const response = await apiClient.post("/uploads/image", form, {
      headers: {
        "Content-Type": false,
      },
    });

    // return the cloudinary upload result (url, publicId, etc.)
    return response.data.data;
  },
};

export default uploadApi;
