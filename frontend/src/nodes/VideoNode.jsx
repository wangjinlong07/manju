import { useState, useEffect } from 'react';
import { Handle, Position, useStore, useReactFlow } from 'reactflow';
import { Clapperboard, Download, Trash2, Cpu } from 'lucide-react';

export default function VideoNode({ id, data, selected }) {
  const videoUrl = data.output?.video_url || null;
  const provider = data.provider || 'cogvideox3';
  const duration = data.duration || '5';
  const mode = data._mode || 'image2video';
  const [inputImage, setInputImage] = useState(null);
  const [hovered, setHovered] = useState(false);

  const { getNode } = useReactFlow();
  const edges = useStore((s) => s.edges);

  // Retrieve incoming image reference dynamically
  useEffect(() => {
    const incoming = edges.filter((e) => e.target === id);
    let img = null;
    for (const edge of incoming) {
      const src = getNode(edge.source);
      if (src?.data?.output?.image_url) {
        img = src.data.output.image_url;
        break;
      }
    }
    setInputImage(img);
  }, [edges, id, getNode]);

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `video-${Date.now()}.mp4`;
    a.click();
  };

  const getModelLabel = () => {
    if (provider.includes('cogvideo')) return '智谱清影';
    if (provider.includes('kling')) return '快手可灵';
    return provider.toUpperCase();
  };

  const getModeLabel = () => {
    if (mode === 'image2video') return '图生视频';
    if (mode === 'text2video') return '文生视频';
    if (mode === 'first_last_frame') return '首尾关键帧';
    return '生成视频';
  };

  return (
    <div 
      className={`relative w-full rounded-2xl overflow-visible bg-white dark:bg-zinc-900 border transition-all duration-300 ${
        selected 
          ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.15)] dark:shadow-[0_0_30px_rgba(99,102,241,0.25)] scale-[1.01]' 
          : 'border-zinc-200 dark:border-zinc-800 shadow-md dark:shadow-xl'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/65 rounded-t-2xl border-b border-zinc-200 dark:border-zinc-850 shrink-0">
        <div className="flex items-center gap-2">
          <Clapperboard size={13} className="text-indigo-555 dark:text-indigo-400" />
          <span className="text-[11px] font-bold tracking-wider text-zinc-800 dark:text-zinc-100">视频渲染</span>
        </div>
        <div className="flex items-center gap-1">
          {videoUrl && (
            <button 
              onClick={handleDownload} 
              className="p-1 rounded-md text-zinc-450 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <Download size={12} />
            </button>
          )}
          <button 
            onClick={() => data.deleteNode?.(id)} 
            className="p-1 rounded-md text-zinc-450 hover:text-red-550 dark:text-zinc-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
 
      {/* Video Viewport / Preview */}
      <div className="p-3 bg-zinc-50/30 dark:bg-zinc-900/40">
        <div className="relative w-full rounded-xl overflow-hidden aspect-[16/10] bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 flex items-center justify-center">
          {videoUrl ? (
            <video 
              src={videoUrl} 
              autoPlay 
              loop 
              muted 
              playsInline
              className="w-full h-full object-cover" 
            />
          ) : inputImage ? (
            <div className="relative w-full h-full">
              <img 
                src={inputImage} 
                alt="" 
                className="w-full h-full object-cover opacity-35" 
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                <Clapperboard size={24} className="text-indigo-500/40 dark:text-indigo-400/50 animate-pulse" />
                <span className="text-[9px] text-zinc-500 dark:text-zinc-500">底图已就绪，等待渲染...</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-700">
              <Clapperboard size={28} />
              <span className="text-[10px] text-zinc-500 dark:text-zinc-600">等待连线底图...</span>
            </div>
          )}
        </div>
      </div>
 
      {/* Node Info / Tags Footer */}
      <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950/50 rounded-b-2xl border-t border-zinc-200 dark:border-zinc-850 flex items-center justify-between gap-2 text-[10px] text-zinc-505 dark:text-zinc-400">
        <div className="flex items-center gap-1 truncate max-w-[130px]">
          <Cpu size={10} className="text-indigo-555 dark:text-indigo-500 shrink-0" />
          <span className="truncate">{getModelLabel()}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono font-medium">{getModeLabel()}</span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span className="text-zinc-550 dark:text-zinc-500">{duration}s</span>
        </div>
      </div>
 
      {/* Handles */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!w-3 !h-3 !bg-sky-500 !border-2 !border-white dark:!border-zinc-900 !shadow-md transition-colors hover:!bg-sky-400" 
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white dark:!border-zinc-900 !shadow-md transition-colors hover:!bg-emerald-400" 
      />
    </div>
  );
}
