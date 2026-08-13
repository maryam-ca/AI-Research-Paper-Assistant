import { create } from 'zustand';

export const useAppStore = create((set) => ({
  darkMode: localStorage.getItem('darkMode') === 'true',
  toggleDarkMode: () =>
    set((state) => {
      const next = !state.darkMode;
      localStorage.setItem('darkMode', String(next));
      return { darkMode: next };
    }),

  papers: [],
  setPapers: (papers) => set({ papers }),
  updatePaper: (paper) =>
    set((state) => ({
      papers: state.papers.map((p) => (p.id === paper.id ? { ...p, ...paper } : p)),
      currentPaper: state.currentPaper && state.currentPaper.id === paper.id
        ? { ...state.currentPaper, ...paper }
        : state.currentPaper,
    })),
  removePaper: (id) =>
    set((state) => ({
      papers: state.papers.filter((p) => p.id !== id),
      compareSelection: state.compareSelection.filter((x) => x !== id),
    })),

  collections: [],
  setCollections: (collections) => set({ collections }),

  currentPaper: null,
  setCurrentPaper: (paper) => set({ currentPaper: paper }),

  compareOpen: false,
  setCompareOpen: (v) => set({ compareOpen: v }),
  compareSelection: [],
  toggleCompare: (id) =>
    set((state) => {
      const has = state.compareSelection.includes(id);
      return {
        compareSelection: has
          ? state.compareSelection.filter((x) => x !== id)
          : [...state.compareSelection, id],
      };
    }),
}));
