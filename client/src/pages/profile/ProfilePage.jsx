import { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Camera, Mail } from "lucide-react";
import toast from "react-hot-toast";

import { userApi } from "../../api/user.api.js";
import { uploadApi } from "../../api/upload.api.js";
import { fetchCurrentUser } from "../../store/slices/authSlice.js";
import { useAuth } from "../../hooks/useAuth.js";
import { USER_ROLE } from "../../constants/roles.js";
import { formatDate } from "../../utils/formatDate.js";

import Avatar from "../../components/ui/Avatar.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";

function ProfilePage() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || "");
  const [favoriteCuisines, setFavoriteCuisines] = useState(
    Array.isArray(user?.favoriteCuisines)
      ? user.favoriteCuisines.join(", ")
      : ""
  );
  const [profileImage, setProfileImage] = useState(user?.profileImage || "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCustomer = user?.role === USER_ROLE.CUSTOMER;

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadApi.image(file);
      setProfileImage(uploaded?.url || uploaded?.secure_url || uploaded);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to upload image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updates = { fullName, phoneNumber, profileImage };
      if (isCustomer) {
        updates.favoriteCuisines = favoriteCuisines
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
      }
      await userApi.updateProfile(updates);
      await dispatch(fetchCurrentUser());
      toast.success("Profile updated successfully.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Account Profile</h1>
        <p className="text-sm text-muted">View and update your personal details</p>
      </div>

      <Card className="p-6 sm:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-6 border-b border-gray-100">
          <div className="flex flex-col items-center gap-3">
            <Avatar user={{ ...user, profileImage }} size={88} className="h-20 w-20 text-xl" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Upload profile picture"
              onChange={handleImageSelect}
            />
            <Button
              variant="outline"
              size="sm"
              isLoading={isUploading}
              loadingText="Uploading..."
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={14} className="mr-1.5" />
              {profileImage ? "Change Photo" : "Add Photo"}
            </Button>
          </div>

          <div className="text-center sm:text-left">
            <h2 className="text-xl font-bold text-text">{user?.fullName}</h2>
            <p className="text-sm text-muted flex items-center justify-center sm:justify-start gap-1 mt-0.5">
              <Mail size={14} /> {user?.email}
            </p>
            <div className="mt-2 flex items-center justify-center sm:justify-start gap-2">
              <Badge variant="info" className="uppercase">
                {user?.role}
              </Badge>
              {user?.createdAt && (
                <span className="text-xs text-muted">
                  Member since {formatDate(user.createdAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 pt-6">
          <Input
            id="profile-fullName"
            label="Full Name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={3}
            placeholder="Your full name"
          />

          <Input
            id="profile-email"
            label="Email Address"
            type="email"
            value={user?.email || ""}
            disabled
            className="bg-gray-50 text-gray-500 cursor-not-allowed"
          />

          <Input
            id="profile-phone"
            label="Phone Number"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="9876543210"
            hint="10-digit mobile number"
          />

          {isCustomer && (
            <Input
              id="profile-cuisines"
              label="Favorite Cuisines"
              type="text"
              value={favoriteCuisines}
              onChange={(e) => setFavoriteCuisines(e.target.value)}
              placeholder="North Indian, Chinese, Desserts"
              hint="Separate cuisines with commas"
            />
          )}

          <div className="pt-4 flex justify-end">
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default ProfilePage;
