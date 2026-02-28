import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import useAuthStore from '../stores/authStore';
import { authAPI, bookmarksAPI, notificationsAPI } from '../services/api';
import { getAvatarInitial, resolveProfileImageUrl } from '../utils/userProfile';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const getErrorMessage = (error, fallback) => error?.response?.data?.detail || fallback;

function MyPage() {
  const queryClient = useQueryClient();
  const { user, token, fetchUser, setUser } = useAuthStore();

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

  const { data: bookmarksData, isLoading: bookmarksLoading } = useQuery({
    queryKey: ['my-bookmarks'],
    queryFn: () => bookmarksAPI.getMyBookmarks(1, 20),
    enabled: !!token,
  });

  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: ['my-notifications'],
    queryFn: () => notificationsAPI.getMyNotifications(1, 20),
    enabled: !!token,
  });

  const { data: unreadCountData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsAPI.getUnreadCount(),
    enabled: !!token,
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: (notificationId) => notificationsAPI.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-notifications']);
      queryClient.invalidateQueries(['notifications-unread-count']);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to mark notification as read.'));
    },
  });

  const markAllNotificationsReadMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-notifications']);
      queryClient.invalidateQueries(['notifications-unread-count']);
      toast.success('All notifications marked as read.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to mark all notifications as read.'));
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId) => notificationsAPI.deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries(['my-notifications']);
      queryClient.invalidateQueries(['notifications-unread-count']);
      toast.success('Notification deleted.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete notification.'));
    },
  });

  const handleNicknameUpdate = async (event) => {
    event.preventDefault();

    const nextUsername = username.trim();
    if (nextUsername.length < 3) {
      toast.error('Nickname must be at least 3 characters.');
      return;
    }

    if (nextUsername === user?.username) {
      toast('No changes detected.');
      return;
    }

    setIsSavingNickname(true);

    try {
      const response = await authAPI.updateMeProfile({ username: nextUsername });
      setUser(response.data);
      toast.success('Nickname updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update nickname.'));
    } finally {
      setIsSavingNickname(false);
    }
  };

  const handlePasswordUpdate = async (event) => {
    event.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
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
      toast.success('Password updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update password.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleProfileImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only JPG, PNG, GIF, WEBP are allowed.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Profile image must be 5MB or smaller.');
      return;
    }

    setIsUploadingImage(true);

    try {
      const response = await authAPI.uploadProfileImage(file);
      setUser(response.data);
      toast.success('Profile image updated.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update profile image.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (!user) {
    return (
      <section className="max-w-3xl mx-auto">
        <div className="card p-8 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-ink-300 border-t-ink-700 rounded-full animate-spin" />
          <p className="text-sm text-ink-600">Loading my page...</p>
        </div>
      </section>
    );
  }

  const bookmarks = bookmarksData?.data?.bookmarks || [];
  const notifications = notificationsData?.data?.notifications || [];
  const unreadCount = unreadCountData?.data?.unread_count || 0;

  return (
    <section className="max-w-5xl mx-auto space-y-6">
      <header className="card p-6 md:p-8 bg-gradient-to-br from-paper-50 via-paper-100 to-paper-200">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-500 font-semibold">Account</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-950">My Page</h1>
        <p className="mt-2 text-sm text-ink-600">
          Manage profile, passwords, bookmarks, and notifications from one place.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
        <article className="card p-6 md:p-7">
          <h2 className="font-display text-xl font-semibold text-ink-900">Profile Photo</h2>
          <p className="mt-1 text-sm text-ink-500">This image appears in comments and posts.</p>

          <div className="mt-6 flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-2xl border border-ink-200 bg-ink-100 overflow-hidden shadow-soft">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl}
                  alt={`${user.username} profile`}
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
                {isUploadingImage ? 'Uploading...' : 'Upload Photo'}
              </button>
              <p className="text-xs text-ink-400">JPG, PNG, GIF, WEBP / max 5MB</p>
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
          <h2 className="font-display text-xl font-semibold text-ink-900">Nickname</h2>
          <p className="mt-1 text-sm text-ink-500">Update how your name appears to others.</p>

          <form onSubmit={handleNicknameUpdate} className="mt-6 space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-semibold text-ink-700 mb-2">
                Nickname
              </label>
              <input
                id="nickname"
                type="text"
                minLength={3}
                maxLength={50}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="input-field"
                placeholder="Enter nickname"
              />
            </div>

            <button type="submit" disabled={isSavingNickname} className="btn-accent w-full">
              {isSavingNickname ? 'Saving...' : 'Save Nickname'}
            </button>
          </form>
        </article>
      </div>

      <article className="card p-6 md:p-7">
        <h2 className="font-display text-xl font-semibold text-ink-900">Password</h2>
        <p className="mt-1 text-sm text-ink-500">Change your password securely.</p>

        <form onSubmit={handlePasswordUpdate} className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="current-password" className="block text-sm font-semibold text-ink-700 mb-2">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="input-field"
              placeholder="Current password"
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-semibold text-ink-700 mb-2">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="input-field"
              placeholder="At least 6 chars"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-semibold text-ink-700 mb-2">
              Confirm Password
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
              placeholder="Repeat password"
            />
          </div>

          <div className="md:col-span-3 flex justify-end pt-2">
            <button type="submit" disabled={isChangingPassword} className="btn-primary min-w-[180px]">
              {isChangingPassword ? 'Updating...' : 'Change Password'}
            </button>
          </div>
        </form>
      </article>

      <div className="grid gap-6 lg:grid-cols-2">
        <article className="card p-6 md:p-7" id="notifications">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-ink-900">Notifications</h2>
              <p className="mt-1 text-sm text-ink-500">Unread: {unreadCount}</p>
            </div>
            <button
              onClick={() => markAllNotificationsReadMutation.mutate()}
              disabled={markAllNotificationsReadMutation.isPending || notifications.length === 0}
              className="btn-ghost text-sm"
            >
              Mark all read
            </button>
          </div>

          <div className="mt-4 space-y-2 max-h-[360px] overflow-auto pr-1">
            {notificationsLoading && (
              <p className="text-sm text-ink-400">Loading notifications...</p>
            )}

            {!notificationsLoading && notifications.length === 0 && (
              <p className="text-sm text-ink-400">No notifications yet.</p>
            )}

            {notifications.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border px-3 py-2.5 ${
                  item.is_read ? 'border-ink-100 bg-paper-50' : 'border-ink-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-2 justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-800 break-words">{item.content}</p>
                    <p className="text-xs text-ink-400 mt-1">
                      {new Intl.DateTimeFormat('ko-KR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(item.created_at))}
                    </p>

                    {item.related_post_id && (
                      <Link
                        to={`/posts/${item.related_post_id}`}
                        onClick={() => {
                          if (!item.is_read) {
                            markNotificationReadMutation.mutate(item.id);
                          }
                        }}
                        className="inline-block text-xs mt-1 text-ink-700 underline underline-offset-2"
                      >
                        Open post
                      </Link>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {!item.is_read && (
                      <button
                        onClick={() => markNotificationReadMutation.mutate(item.id)}
                        className="text-xs text-ink-500 hover:text-ink-800"
                      >
                        Read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotificationMutation.mutate(item.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card p-6 md:p-7">
          <h2 className="font-display text-xl font-semibold text-ink-900">Bookmarks</h2>
          <p className="mt-1 text-sm text-ink-500">Your saved posts for later.</p>

          <div className="mt-4 space-y-2 max-h-[360px] overflow-auto pr-1">
            {bookmarksLoading && (
              <p className="text-sm text-ink-400">Loading bookmarks...</p>
            )}

            {!bookmarksLoading && bookmarks.length === 0 && (
              <p className="text-sm text-ink-400">No bookmarks yet.</p>
            )}

            {bookmarks.map((item) => (
              <Link
                key={item.id}
                to={`/posts/${item.post_id}`}
                className="block rounded-lg border border-ink-100 hover:border-ink-300 bg-paper-50 hover:bg-white px-3 py-2.5 transition-colors"
              >
                <p className="text-sm font-semibold text-ink-900 truncate">{item.post?.title}</p>
                <p className="text-xs text-ink-500 mt-1">
                  {item.post?.category_name || 'General'} ? {item.post?.author_username || 'Unknown'}
                </p>
                <p className="text-xs text-ink-400 mt-1">
                  Views {item.post?.views || 0} ? Likes {item.post?.likes_count || 0} ? Comments {item.post?.comment_count || 0}
                </p>
              </Link>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default MyPage;
