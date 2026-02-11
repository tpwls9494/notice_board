import { create } from 'zustand';
import { mcpCategoriesAPI } from '../services/api';

const useMcpCategoriesStore = create((set) => ({
  categories: [],
  isLoading: false,
  error: null,

  fetchCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await mcpCategoriesAPI.getCategories();
      set({ categories: response.data, isLoading: false });
    } catch (error) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch MCP categories',
        isLoading: false,
      });
    }
  },
}));

export default useMcpCategoriesStore;
