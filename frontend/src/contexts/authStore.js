import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('lume_token') || null,
  user: JSON.parse(localStorage.getItem('lume_user') || 'null'),

  login: (token, user) => {
    localStorage.setItem('lume_token', token);
    localStorage.setItem('lume_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('lume_token');
    localStorage.removeItem('lume_user');
    set({ token: null, user: null });
  },
}));
