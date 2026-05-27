import { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Image as ImageIcon, Download, Trash2, Cpu } from 'lucide-react';

export default function GachaNode({ id, data, selected }) {
  const currentImage = data.output?.image_url || null;
  const provider = data.provider || 'flux-schnell';
  const ratio = data.ratio || '16:9';
  const count = data.count || 4;
  const skill = data.skill || '';

  const [hovered, setHovered] = useState(false);

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!currentImage) return;
    const a = document.createElement('a');
    a.href = currentImage;
    a.download = `gacha-${Date.now()}.png`;
    a.click();
  };

  const getModelLabel = () => {
    if (provider.includes('flux')) return 'FLUX.1';
    if (provider.includes('kolors')) return 'Kolors';
    return provider.toUpperCase();
  };

  return (
    <div 
      className={`relative w-full rounded-2xl overflow-visible bg-white dark:bg-zinc-900 border transition-all duration-300 ${
        selected 
          ? 'border-sky-500 shadow-[0_0_30px_rgba(56,189,248,0.15)] dark:shadow-[0_0_30px_rgba(56,189,248,0.25)] scale-[1.01]' 
          : 'border-zinc-200 dark:border-zinc-800 shadow-md dark:shadow-xl'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Node Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-950/65 rounded-t-2xl border-b border-zinc-200 dark:border-zinc-850 shrink-0">
        <div className="flex items-center gap-2">
          <ImageIcon size={13} className="text-sky-550 dark:text-sky-400" />
          <span className="text-[11px] font-bold tracking-wider text-zinc-800 dark:text-zinc-100">图像生成</span>
        </div>
        <div className="flex items-center gap-1">
          {currentImage && (
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
 
      {/* Image Display / Placeholder */}
      <div className="p-3 bg-zinc-50/30 dark:bg-zinc-900/40">
        <div className="relative w-full rounded-xl overflow-hidden aspect-[16/10] bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 flex items-center justify-center">
          {currentImage ? (
            <img 
              src={currentImage} 
              alt="" 
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" 
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400 dark:text-zinc-700">
              <ImageIcon size={28} className="animate-pulse" />
              <span className="text-[10px] text-zinc-550 dark:text-zinc-600">等待抽卡生成...</span>
            </div>
          )}
        </div>
      </div>
 
      {/* Node Info / Tags Footer */}
      <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950/50 rounded-b-2xl border-t border-zinc-200 dark:border-zinc-850 flex items-center justify-between gap-2 text-[10px] text-zinc-500 dark:text-zinc-400">
        <div className="flex items-center gap-1 truncate max-w-[130px]">
          <Cpu size={10} className="text-sky-555 dark:text-sky-500 shrink-0" />
          <span className="truncate">{getModelLabel()}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono font-medium">{ratio}</span>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span className="text-zinc-550 dark:text-zinc-500">抽卡: {count}</span>
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
