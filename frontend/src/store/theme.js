import { create } from 'zustand';

export const useThemeStore = create((set) => ({
  theme: 'dark',
  toggleTheme: () => set((state) => {
    const next = state.theme === 'dark' ? 'light' : 'dark';
    // 切换 HTML class
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    return { theme: next };
  }),
}));
