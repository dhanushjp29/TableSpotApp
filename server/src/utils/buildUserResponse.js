const buildUserResponse = (user) => ({
  id: user._id,
  userCode: user.userCode,
  fullName: user.fullName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  bookingStatus: user.bookingStatus || "ACTIVE",
  bookingRestrictedAt: user.bookingRestrictedAt || null,
  bookingRestrictedBy: user.bookingRestrictedBy || null,
  profileImage: user.profileImage,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

export default buildUserResponse;
