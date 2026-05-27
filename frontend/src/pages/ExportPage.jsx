import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Download, Film, CheckSquare, Square, Video } from 'lucide-react';
import { useProjectStore } from '../store/project';

export default function ExportPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { currentProject, openProject } = useProjectStore();
  const [selected, setSelected] = useState(new Set());
  const [previewUrl, setPreviewUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!currentProject || currentProject.id !== projectId) {
      openProject(projectId);
    }
  }, [projectId, currentProject, openProject]);

  const videoNodes = useMemo(() => {
    if (!currentProject?.canvas_json?.nodes) return [];
    return currentProject.canvas_json.nodes
      .filter((n) => n.type === 'videoNode' && n.data?.output?.video_url)
      .map((n, i) => ({
        id: n.id,
        name: n.data?.label || n.data?.name || `视频片段 ${i + 1}`,
        url: n.data.output.video_url,
      }));
  }, [currentProject]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === videoNodes.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(videoNodes.map((v) => v.id)));
    }
  };

  const handleDownload = async () => {
    const urls = videoNodes.filter((v) => selected.has(v.id));
    if (urls.length === 0) return;
    setDownloading(true);
    for (const video of urls) {
      const a = document.createElement('a');
      a.href = video.url;
      a.download = `${video.name}.mp4`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 400));
    }
    setDownloading(false);
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 transition-colors">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shrink-0">
        <button
          onClick={() => navigate(`/editor/${projectId}`)}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>返回编辑器</span>
        </button>
        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
        <h1 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          导出中心
        </h1>
        {currentProject && (
          <>
            <span className="text-zinc-350 dark:text-zinc-650">—</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-450 truncate max-w-[200px]">
              {currentProject.name}
            </span>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Video preview */}
        <div className="w-[70%] flex items-center justify-center p-8 border-r bg-zinc-100/50 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800">
          {previewUrl ? (
            <video
              src={previewUrl}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-xl bg-black shadow-2xl object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-zinc-400 dark:text-zinc-600">
              <div className="w-28 h-28 rounded-2xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-center shadow-sm">
                <Play size={40} className="text-zinc-350 dark:text-zinc-650 ml-1" />
              </div>
              <p className="text-sm">点击右侧视频进行预览</p>
            </div>
          )}
        </div>

        {/* Right: Export settings */}
        <div className="w-[30%] flex flex-col min-h-0 bg-white dark:bg-zinc-900/60 border-l border-zinc-200 dark:border-zinc-800">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-850 dark:text-zinc-200 flex items-center gap-2">
              <Film size={15} className="text-indigo-650 dark:text-indigo-400" />
              导出设置
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {videoNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400 dark:text-zinc-600">
                <Video size={32} />
                <p className="text-sm text-center">当前项目暂无已生成的视频</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-500">
                    共 {videoNodes.length} 个视频
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                  >
                    {selected.size === videoNodes.length ? '取消全选' : '全选'}
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {videoNodes.map((video) => {
                    const isSelected = selected.has(video.id);
                    const isPreviewing = previewUrl === video.url;
                    return (
                      <div
                        key={video.id}
                        className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          isPreviewing
                            ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 shadow-sm'
                            : 'bg-zinc-50/50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/40 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:bg-zinc-650'
                        }`}
                        onClick={() => setPreviewUrl(video.url)}
                      >
                        <div className="w-14 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700/60 border border-zinc-300 dark:border-zinc-600/30 flex items-center justify-center shrink-0">
                          <Play size={14} className="text-zinc-550 dark:text-zinc-400 ml-0.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                            {video.name}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(video.id);
                          }}
                          className="shrink-0 p-1 rounded-md transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700/50"
                        >
                          {isSelected ? (
                            <CheckSquare size={18} className="text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square size={18} className="text-zinc-400 dark:text-zinc-600 group-hover:text-zinc-600 dark:group-hover:text-zinc-400" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {videoNodes.length > 0 && (
            <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
              <button
                onClick={handleDownload}
                disabled={selected.size === 0 || downloading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-650 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
              >
                <Download size={15} />
                {downloading
                  ? '下载中...'
                  : selected.size > 0
                    ? `下载选中视频 (${selected.size})`
                    : '下载选中视频'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
