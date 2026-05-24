import React, { useEffect, useState } from 'react';
import { FolderOpen, Plus, Trash2, Edit3, X, Save, Clock } from 'lucide-react';
import { useProjectStore } from '../store/project';
import { useThemeStore } from '../store/theme';

export default function ProjectManager({ open, onClose, onOpenProject }) {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const { projects, loading, fetchProjects, createProject, deleteProject, renameProject } = useProjectStore();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (open) fetchProjects();
  }, [open, fetchProjects]);

  if (!open) return null;

  const handleCreate = async () => {
    const project = await createProject();
    if (project) onOpenProject(project);
  };

  const handleRename = async (id) => {
    if (editName.trim()) {
      await renameProject(editName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteProject(id);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`relative w-[480px] max-h-[70vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-purple-400" />
            <h2 className={`text-base font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>文稿管理</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition-colors">
              <Plus size={13} /> 新建
            </button>
            <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500'}`}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && <p className={`text-center py-8 text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>加载中…</p>}
          {!loading && projects.length === 0 && (
            <p className={`text-center py-8 text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>暂无文稿，点击"新建"开始创作</p>
          )}
          {projects.map((p) => (
            <div key={p.id} onClick={() => onOpenProject(p)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 cursor-pointer transition-all group ${isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-50'}`}>
              <FolderOpen size={16} className={`${isDark ? 'text-zinc-500' : 'text-zinc-400'}`} />
              <div className="flex-1 min-w-0">
                {editingId === p.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRename(p.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(p.id)}
                    autoFocus
                    className={`w-full px-2 py-0.5 rounded text-sm ${isDark ? 'bg-zinc-800 text-zinc-100 border-zinc-600' : 'bg-zinc-100 text-zinc-800 border-zinc-300'} border outline-none`}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>{p.name}</p>
                )}
                <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  <Clock size={9} /> {new Date(p.updated_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                </p>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setEditName(p.name); }}
                  className={`p-1.5 rounded-md ${isDark ? 'hover:bg-zinc-700 text-zinc-500' : 'hover:bg-zinc-200 text-zinc-400'}`}>
                  <Edit3 size={12} />
                </button>
                <button onClick={(e) => handleDelete(e, p.id)}
                  className="p-1.5 rounded-md hover:bg-red-900/30 text-red-400">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
