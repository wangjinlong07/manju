import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  LayoutGrid,
  List,
  Trash2,
  Clock,
  Sparkles,
  FolderOpen,
  X,
  ArrowRight,
  Film,
} from 'lucide-react';
import { useProjectStore } from '../store/project';

const RATIO_OPTIONS = [
  { key: '16:9', label: '横屏', w: 16, h: 9 },
  { key: '9:16', label: '竖屏', w: 9, h: 16 },
  { key: '1:1', label: '方形', w: 1, h: 1 },
  { key: '21:9', label: '电影感', w: 21, h: 9 },
];

const CARD_GRADIENTS = [
  'from-indigo-600/30 via-purple-600/20 to-pink-600/10',
  'from-sky-600/30 via-cyan-600/20 to-teal-600/10',
  'from-amber-600/30 via-orange-600/20 to-rose-600/10',
  'from-emerald-600/30 via-teal-600/20 to-cyan-600/10',
  'from-violet-600/30 via-fuchsia-600/20 to-pink-600/10',
  'from-rose-600/30 via-pink-600/20 to-purple-600/10',
];

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function NewProjectDialog({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [ratio, setRatio] = useState('16:9');
 
  useEffect(() => {
    if (open) {
      setName('');
      setRatio('16:9');
    }
  }, [open]);
 
  if (!open) return null;
 
  const handleCreate = () => {
    const projectName = name.trim() || '未命名项目';
    onCreate(projectName, ratio);
  };
 
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-[520px] rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-2xl shadow-[0_24px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/15 flex items-center justify-center">
              <Sparkles size={16} className="text-indigo-650 dark:text-indigo-400" />
            </div>
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-100">新建项目配置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
 
        <div className="px-6 py-5 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">项目名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="输入项目名称…"
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all"
            />
          </div>
 
          <div className="space-y-2.5">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">画布比例</label>
            <div className="grid grid-cols-4 gap-3">
              {RATIO_OPTIONS.map((opt) => {
                const isActive = ratio === opt.key;
                const maxDim = 48;
                const scale = maxDim / Math.max(opt.w, opt.h);
                const w = Math.round(opt.w * scale);
                const h = Math.round(opt.h * scale);
                return (
                  <button
                    key={opt.key}
                    onClick={() => setRatio(opt.key)}
                    className={`flex flex-col items-center gap-2.5 py-4 rounded-xl border transition-all ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/8 shadow-[0_0_20px_rgba(99,102,241,0.08)]'
                        : 'border-zinc-200 dark:border-zinc-700/40 bg-zinc-50 dark:bg-zinc-800/30 hover:border-zinc-300 dark:hover:border-zinc-650 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div
                      className={`rounded-sm transition-colors ${
                        isActive ? 'bg-indigo-550 dark:bg-indigo-400/80 ring-2 ring-indigo-400/20' : 'bg-zinc-300 dark:bg-zinc-600/60'
                      }`}
                      style={{ width: w, height: h }}
                    />
                    <div className="text-center">
                      <p className={`text-xs font-medium ${isActive ? 'text-indigo-650 dark:text-indigo-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {opt.key}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${isActive ? 'text-indigo-500/65 dark:text-indigo-400/60' : 'text-zinc-400 dark:text-zinc-600'}`}>
                        {opt.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
 
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-zinc-100 dark:border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            className="px-5 py-2 rounded-xl text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-505 transition-colors shadow-lg shadow-indigo-600/20"
          >
            创建项目
          </button>
        </div>
      </div>
    </div>
  );
}
 
function ProjectCardContextMenu({ x, y, onDelete, onClose }) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [onClose]);
 
  return (
    <div
      className="fixed z-[250] py-1.5 min-w-[140px] rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900/95 backdrop-blur-2xl shadow-[0_12px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.7)]"
      style={{ left: x, top: y }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs text-red-550 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={13} />
        删除项目
      </button>
    </div>
  );
}

export default function WorkspacePage() {
  const navigate = useNavigate();
  const { projects, loading, fetchProjects, createProject, deleteProject } = useProjectStore();
  const [viewMode, setViewMode] = useState('grid');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const gradientMap = useMemo(() => {
    const map = {};
    projects.forEach((p, i) => {
      map[p.id] = CARD_GRADIENTS[i % CARD_GRADIENTS.length];
    });
    return map;
  }, [projects]);

  const handleCreate = async (name, ratio) => {
    const project = await createProject(name, ratio);
    if (project) {
      setShowNewDialog(false);
      navigate(`/editor/${project.id}`);
    }
  };

  const handleDelete = async (id) => {
    await deleteProject(id);
  };

  const handleCardClick = (projectId) => {
    navigate(`/editor/${projectId}`);
  };

  const handleContextMenu = (e, projectId) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, projectId });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50 dark:bg-[#0f0f14] transition-colors">
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 tracking-tight">草稿箱</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {loading ? '加载中…' : `共 ${projects.length} 个项目`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5 p-1 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/60 border border-zinc-300/40 dark:border-zinc-700/40">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-zinc-700/80 text-zinc-850 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                }`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-700/80 text-zinc-850 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                }`}
              >
                <List size={15} />
              </button>
            </div>
            <button
              onClick={() => setShowNewDialog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-600/20"
            >
              <Plus size={15} />
              新建项目
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm text-zinc-500">加载项目中…</p>
            </div>
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/40 flex items-center justify-center shadow-sm">
                <FolderOpen size={28} className="text-zinc-400 dark:text-zinc-650" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">还没有任何项目</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">点击「新建项目」开始你的创作旅程</p>
              </div>
              <button
                onClick={() => setShowNewDialog(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-50 transition-colors mt-2"
              >
                <Plus size={14} />
                新建项目
              </button>
            </div>
          </div>
        )}

        {!loading && projects.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleCardClick(project.id)}
                onContextMenu={(e) => handleContextMenu(e, project.id)}
                className="group relative rounded-2xl border border-zinc-200 dark:border-zinc-700/30 bg-white dark:bg-zinc-800/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/70 hover:border-zinc-300 dark:hover:border-zinc-600/50 transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_40px_rgba(0,0,0,0.3)] hover:-translate-y-0.5"
              >
                <div
                  className={`relative h-36 bg-gradient-to-br ${gradientMap[project.id]} overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.05),transparent_60%)]" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/30 backdrop-blur-md border border-white/5">
                    <Film size={10} className="text-zinc-300" />
                    <span className="text-[10px] text-zinc-200">{project.ratio || '16:9'}</span>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                      className="p-1.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/5 text-zinc-300 hover:text-red-400 hover:bg-red-500/15 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3.5">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{project.name}</p>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 flex items-center gap-1">
                    <Clock size={10} />
                    {formatTime(project.updated_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && projects.length > 0 && viewMode === 'list' && (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleCardClick(project.id)}
                onContextMenu={(e) => handleContextMenu(e, project.id)}
                className="group flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-700/30 bg-white dark:bg-zinc-800/30 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:border-zinc-300 dark:hover:border-zinc-600/40 transition-all duration-200 cursor-pointer hover:shadow-sm"
              >
                <div
                  className={`w-20 h-14 rounded-xl bg-gradient-to-br ${gradientMap[project.id]} flex-shrink-0 overflow-hidden relative`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.05),transparent_60%)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{project.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                      <Clock size={10} />
                      {formatTime(project.updated_at)}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-650 flex items-center gap-1">
                      <Film size={10} />
                      {project.ratio || '16:9'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(project.id);
                    }}
                    className="p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(project.id);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    继续编辑
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog
        open={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onCreate={handleCreate}
      />

      {contextMenu && (
        <ProjectCardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDelete={() => handleDelete(contextMenu.projectId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
