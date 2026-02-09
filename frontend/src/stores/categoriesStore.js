import { create } from 'zustand';
import { categoriesAPI } from '../services/api';

const useCategoriesStore = create((set) => ({
  categories: [],
  isLoading: false,
  error: null,

  fetchCategories: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoriesAPI.getCategories();
      set({ categories: response.data, isLoading: false });
    } catch (error) {
      set({
        error: error.response?.data?.detail || 'Failed to fetch categories',
        isLoading: false,
      });
    }
  },

  createCategory: async (name, description) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoriesAPI.createCategory({ name, description });
      set((state) => ({
        categories: [...state.categories, response.data],
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.detail || 'Failed to create category',
        isLoading: false,
      });
      return false;
    }
  },

  updateCategory: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await categoriesAPI.updateCategory(id, data);
      set((state) => ({
        categories: state.categories.map((cat) =>
          cat.id === id ? response.data : cat
        ),
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.detail || 'Failed to update category',
        isLoading: false,
      });
      return false;
    }
  },

  deleteCategory: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await categoriesAPI.deleteCategory(id);
      set((state) => ({
        categories: state.categories.filter((cat) => cat.id !== id),
        isLoading: false,
      }));
      return true;
    } catch (error) {
      set({
        error: error.response?.data?.detail || 'Failed to delete category',
        isLoading: false,
      });
      return false;
    }
  },
}));

export default useCategoriesStore;
