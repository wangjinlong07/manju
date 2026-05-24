import { create } from 'zustand';

export const useCanvasStore = create((set) => ({
  selectedNodeId: null,
  selectedNodeData: null,
  models: { llm: [], image: [], video: [], skills: [] },

  setSelectedNode: (nodeId, nodeData) => set({ selectedNodeId: nodeId, selectedNodeData: nodeData }),
  clearSelection: () => set({ selectedNodeId: null, selectedNodeData: null }),
  setModels: (models) => set({ models }),
}));
