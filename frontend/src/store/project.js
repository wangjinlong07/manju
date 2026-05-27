import { create } from 'zustand';

export const useProjectStore = create((set, get) => ({
  // Current active project
  currentProject: null,
  // List of all projects
  projects: [],
  // Loading / saving states
  loading: false,
  saving: false,
  lastSaved: null,
  dirty: false,  // 画布有未保存变更

  // ─── Actions ───

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      set({ projects: data, loading: false });
    } catch (e) {
      console.error('[ProjectStore] fetchProjects failed:', e);
      set({ loading: false });
    }
  },

  createProject: async (name = '未命名文稿', ratio = '16:9') => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, canvas_json: { ratio, nodes: [], edges: [] } }),
      });
      const project = await res.json();
      set((s) => ({ projects: [project, ...s.projects], currentProject: project, lastSaved: null, dirty: false }));
      return project;
    } catch (e) {
      console.error('[ProjectStore] createProject failed:', e);
      return null;
    }
  },

  openProject: async (projectId) => {
    set({ loading: true, lastSaved: null, dirty: false });
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const project = await res.json();
      set({ currentProject: project, loading: false });
      return project;
    } catch (e) {
      console.error('[ProjectStore] openProject failed:', e);
      set({ loading: false });
      return null;
    }
  },

  saveCanvas: async (nodes, edges) => {
    const { currentProject } = get();
    if (!currentProject) return;
    set({ saving: true });
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvas_json: { nodes, edges } }),
      });
      const updated = await res.json();
      set({ currentProject: updated, saving: false, lastSaved: new Date(), dirty: false });
    } catch (e) {
      console.error('[ProjectStore] saveCanvas failed:', e);
      set({ saving: false });
    }
  },

  markDirty: () => set({ dirty: true }),

  renameProject: async (name) => {
    const { currentProject } = get();
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const updated = await res.json();
      set((s) => ({
        currentProject: updated,
        projects: s.projects.map(p => p.id === updated.id ? { ...p, name: updated.name, updated_at: updated.updated_at } : p),
      }));
    } catch (e) {
      console.error('[ProjectStore] renameProject failed:', e);
    }
  },

  deleteProject: async (projectId) => {
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      set((s) => ({
        projects: s.projects.filter(p => p.id !== projectId),
        currentProject: s.currentProject?.id === projectId ? null : s.currentProject,
      }));
    } catch (e) {
      console.error('[ProjectStore] deleteProject failed:', e);
    }
  },

  clearCurrent: () => set({ currentProject: null }),
}));
