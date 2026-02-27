import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import useAuthStore from '../stores/authStore';
import { authAPI } from '../services/api';
import { getAvatarInitial, resolveProfileImageUrl } from '../utils/userProfile';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const getErrorMessage = (error, fallback) => {
  return error?.response?.data?.detail || fallback;
};

function MyPage() {
  const { user, fetchUser, setUser } = useAuthStore();

  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) {
      fetchUser();
    }
  }, [user, fetchUser]);

  useEffect(() => {
    setUsername(user?.username || '');
  }, [user?.username]);

  const profileImageUrl = useMemo(
    () => resolveProfileImageUrl(user?.profile_image_url),
    [user?.profile_image_url]
  );

  const handleNicknameUpdate = async (event) => {
    event.preventDefault();

    const nextUsername = username.trim();
    if (nextUsername.length < 3) {
      toast.error('닉네임은 3자 이상이어야 합니다.');
      return;
    }

    if (nextUsername === user?.username) {
      toast('변경된 내용이 없습니다.');
      return;
    }

    setIsSavingNickname(true);

    try {
      const response = await authAPI.updateMeProfile({ username: nextUsername });
      setUser(response.data);
      toast.success('닉네임이 변경되었습니다.');
    } catch (error) {
      toast.error(getErrorMessage(error, '닉네임 변경에 실패했습니다.'));
    } finally {
      setIsSavingNickname(false);
    }
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('비밀번호 입력값을 모두 채워주세요.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('새 비밀번호와 확인 값이 일치하지 않습니다.');
      return;
    }

    setIsChangingPassword(true);

    try {
      await authAPI.updateMePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('비밀번호가 변경되었습니다.');
    } catch (error) {
      toast.error(getErrorMessage(error, '비밀번호 변경에 실패했습니다.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleProfileImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('JPG, PNG, GIF, WEBP 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('프로필 이미지는 5MB 이하만 업로드할 수 있습니다.');
      return;
    }

    setIsUploadingImage(true);

    try {
      const response = await authAPI.uploadProfileImage(file);
      setUser(response.data);
      toast.success('프로필 사진이 변경되었습니다.');
    } catch (error) {
      toast.error(getErrorMessage(error, '프로필 사진 변경에 실패했습니다.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (!user) {
    return (
      <section className="max-w-3xl mx-auto">
        <div className="card p-8 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-ink-300 border-t-ink-700 rounded-full animate-spin" />
          <p className="text-sm text-ink-600">마이페이지 정보를 불러오는 중입니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <header className="card p-6 md:p-8 bg-gradient-to-br from-paper-50 via-paper-100 to-paper-200">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-500 font-semibold">Account</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950">마이페이지</h1>
        <p className="mt-2 text-sm text-ink-600">
          닉네임, 비밀번호, 프로필 사진을 여기서 바로 관리할 수 있습니다.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
        <article className="card p-6 md:p-7">
          <h2 className="font-display text-xl font-semibold text-ink-900">프로필 사진</h2>
          <p className="mt-1 text-sm text-ink-500">상단 우측 아바타에 표시될 이미지를 설정합니다.</p>

          <div className="mt-6 flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-2xl border border-ink-200 bg-ink-100 overflow-hidden shadow-soft">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={`${user.username} 프로필`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-display text-3xl font-bold text-ink-700">
                    {getAvatarInitial(user.username)}
                  </span>
                </div>
              )}

              {isUploadingImage && (
                <div className="absolute inset-0 bg-ink-950/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="btn-secondary text-sm"
              >
                {isUploadingImage ? '업로드 중...' : '사진 업로드'}
              </button>
              <p className="text-xs text-ink-400">JPG, PNG, GIF, WEBP / 최대 5MB</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            className="hidden"
            onChange={handleProfileImageUpload}
          />

          <div className="mt-7 pt-5 border-t border-ink-100">
            <p className="text-xs uppercase tracking-[0.16em] text-ink-400 font-semibold">Current Email</p>
            <p className="mt-1 text-sm text-ink-700">{user.email}</p>
          </div>
        </article>

        <article className="card p-6 md:p-7">
          <h2 className="font-display text-xl font-semibold text-ink-900">닉네임 변경</h2>
          <p className="mt-1 text-sm text-ink-500">커뮤니티에 표시되는 이름을 수정합니다.</p>

          <form onSubmit={handleNicknameUpdate} className="mt-6 space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-semibold text-ink-700 mb-2">
                새 닉네임
              </label>
              <input
                id="nickname"
                type="text"
                minLength={3}
                maxLength={50}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="input-field"
                placeholder="닉네임을 입력하세요"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingNickname}
              className="btn-accent w-full"
            >
              {isSavingNickname ? '저장 중...' : '닉네임 저장'}
            </button>
          </form>
        </article>
      </div>

      <article className="card p-6 md:p-7">
        <h2 className="font-display text-xl font-semibold text-ink-900">비밀번호 변경</h2>
        <p className="mt-1 text-sm text-ink-500">보안을 위해 현재 비밀번호 확인 후 새 비밀번호로 변경합니다.</p>

        <form onSubmit={handlePasswordUpdate} className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="current-password" className="block text-sm font-semibold text-ink-700 mb-2">
              현재 비밀번호
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="input-field"
              placeholder="현재 비밀번호"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-semibold text-ink-700 mb-2">
              새 비밀번호
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="input-field"
              placeholder="최소 6자"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-semibold text-ink-700 mb-2">
              새 비밀번호 확인
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={`input-field ${
                confirmPassword && newPassword !== confirmPassword
                  ? 'border-red-300 focus:border-red-400 focus:ring-red-200/50'
                  : ''
              }`}
              placeholder="한 번 더 입력"
            />
          </div>

          <div className="md:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="btn-primary min-w-[180px]"
            >
              {isChangingPassword ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}

export default MyPage;
