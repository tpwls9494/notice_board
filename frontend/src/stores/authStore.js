import { create } from 'zustand';
import { authAPI } from '../services/api';

let revision = 0;
let pending = null;
// Compatibility flag for existing UI guards; this is NOT an API credential.
const sessionState = (user) => ({ user, token: user ? 'cookie-session' : null, isAuthReady: true });

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthReady: false,
  isLoading: false,
  error: null,
  setUser: (user) => set({ user }),

  login: async (email, password) => {
    ++revision;
    set({ isLoading: true, error: null });
    try {
      await authAPI.login({ email, password });
      const response = await authAPI.getSession();
      if (!response.data.user) throw new Error('Session was not established');
      ++revision;
      set({ ...sessionState(response.data.user), isLoading: false });
      return true;
    } catch (error) {
      let errorMessage = '로그인에 실패했습니다';

      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.status === 401) {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다';
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.detail || '입력 정보를 확인해주세요';
      } else if (!error.response) {
        errorMessage = '서버에 연결할 수 없습니다';
      }

      set({
        error: errorMessage,
        isLoading: false
      });
      return false;
    }
  },

  register: async (email, username, password, emailVerificationTicket) => {
    set({ isLoading: true, error: null });
    try {
      await authAPI.register({
        email,
        username,
        password,
        email_verification_ticket: emailVerificationTicket,
      });
      set({ isLoading: false });
      return true;
    } catch (error) {
      let errorMessage = '회원가입에 실패했습니다';

      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.detail || '입력 정보를 확인해주세요';
      } else if (!error.response) {
        errorMessage = '서버에 연결할 수 없습니다';
      }

      set({
        error: errorMessage,
        isLoading: false
      });
      return false;
    }
  },

  logout: async () => {
    ++revision;
    await authAPI.logout();
    ++revision;
    set(sessionState(null));
  },

  fetchUser: async () => {
    if (pending?.revision === revision) return pending.promise;
    const started = revision;
    const promise = authAPI.getSession().then(({ data }) => {
      if (started === revision) set(sessionState(data.user));
      return data.user;
    }).catch(() => {
      // A transient network failure must not discard an open editor. The server
      // still verifies every protected request; only a successful null revokes UI state.
      if (started === revision) set({ isAuthReady: true });
      return null;
    }).finally(() => { if (pending?.promise === promise) pending = null; });
    pending = { revision: started, promise };
    return promise;
  },

  clearError: () => {
    set({ error: null });
  },
}));

export default useAuthStore;
