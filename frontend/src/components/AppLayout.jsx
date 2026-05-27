import React from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Image, Clapperboard, Upload, LayoutGrid, FileText, Play } from 'lucide-react';
import PupuLinLogo from './PupuLinLogo';
import { useThemeStore } from '../store/theme';

/**
 * AppLayout — 全站共享布局壳层
 * 包含：顶栏（Logo + 标题 + 导出按钮）+ 左侧导航 + 内容 Outlet
 */
const WORKSPACE_NAV = [
  { id: 'all', label: '全部项目', icon: LayoutGrid, path: '/' },
];

const EDITOR_NAV = [
  { id: 'imageNode', label: '图片节点', icon: Image, draggable: 'gachaNode' },
  { id: 'videoNode', label: '视频节点', icon: Clapperboard, draggable: 'videoNode' },
  { id: 'importImage', label: '导入图片', icon: Upload, action: 'import' },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  const isEditor = location.pathname.startsWith('/editor');
  const isExport = location.pathname.startsWith('/export');

  // 页面标题
  const getSubtitle = () => {
    if (isEditor) return 'AI剧创作';
    if (isExport) return '导出与预览中心';
    return '项目工作台';
  };

  const handleDragStart = (e, nodeType) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleImportImage = () => {
    // 触发全局自定义事件让 EditorPage 响应
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const event = new CustomEvent('pupulin:import-image', { detail: { file } });
        window.dispatchEvent(event);
      }
    };
    input.click();
  };

  return (
    <div className={`w-screen h-screen flex flex-col overflow-hidden ${isDark ? 'bg-[#0f0f14]' : 'bg-zinc-50'}`}>
      {/* ═══ 顶栏 ═══ */}
      <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b z-50 bg-white dark:bg-[#141419] border-zinc-200 dark:border-zinc-800/60">
        <div 
          onClick={() => navigate('/')}
          className="flex items-center cursor-pointer hover:opacity-85 transition-opacity"
        >
          <PupuLinLogo size={24} subtitle={getSubtitle()} />
        </div>
        <div className="flex items-center gap-3">
          {isEditor && (
            <button
              onClick={() => navigate(`/export/${params.projectId}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium border transition-all hover:scale-[1.02] active:scale-[0.98] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100"
            >
              <Play size={13} className="text-indigo-550 dark:text-indigo-400" />
              导出视频
            </button>
          )}
        </div>
      </header>
 
      <div className="flex flex-1 overflow-hidden">
        {/* ═══ 左侧导航栏 ═══ */}
        <aside className="w-[72px] shrink-0 flex flex-col items-center pt-4 pb-4 gap-1 border-r bg-white dark:bg-[#141419] border-zinc-200 dark:border-zinc-800/60">
          {!isEditor && !isExport && WORKSPACE_NAV.map(({ id, label, icon: Icon, path }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={id}
                onClick={() => navigate(path)}
                className={`w-14 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100'
                    : 'text-zinc-400 dark:text-zinc-505 hover:text-zinc-650 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
 
          {(isEditor || isExport) && (
            <>
              {/* 返回首页 / 工作台 */}
              <button
                onClick={() => navigate('/')}
                className="w-14 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-medium transition-all cursor-pointer text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              >
                <LayoutGrid size={18} />
                工作台
              </button>
              <div className="w-10 h-px my-1 bg-zinc-200 dark:bg-zinc-800/60" />
              
              {EDITOR_NAV.map(({ id, label, icon: Icon, draggable, action }) => (
                <div
                  key={id}
                  draggable={!!draggable}
                  onDragStart={draggable ? (e) => handleDragStart(e, draggable) : undefined}
                  onClick={action === 'import' ? handleImportImage : undefined}
                  className={`w-14 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-medium transition-all cursor-pointer select-none text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 ${
                    draggable ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </div>
              ))}
            </>
          )}
        </aside>

        {/* ═══ 内容区域 ═══ */}
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
