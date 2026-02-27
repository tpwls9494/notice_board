import { resolveApiAssetUrl } from '../services/api';

export const getAvatarInitial = (username) => {
  const normalized = (username || '').trim();
  return normalized ? normalized[0].toUpperCase() : '?';
};

export const resolveProfileImageUrl = (profileImageUrl) => {
  if (!profileImageUrl) return null;
  return resolveApiAssetUrl(profileImageUrl);
};
