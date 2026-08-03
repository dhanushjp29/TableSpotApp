const buildUserResponse = (user) => ({
  id: user._id,
  userCode: user.userCode,
  fullName: user.fullName,
  email: user.email,
  phoneNumber: user.phoneNumber,
  role: user.role,
  profileImage: user.profileImage,
  isEmailVerified: user.isEmailVerified,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

export default buildUserResponse;
