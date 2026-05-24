import { Handle, Position } from 'reactflow';
import { Image, Trash2 } from 'lucide-react';

export default function LocalImageNode({ id, data, selected }) {
  return (
    <div className={`w-[220px] rounded-xl overflow-visible transition-shadow ${selected ? 'shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'shadow-xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-700 to-teal-600 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Image size={12} className="text-emerald-200" />
          <span className="text-[11px] font-bold text-white">参考图</span>
        </div>
        <button onClick={() => data.deleteNode?.(id)} className="p-1 rounded hover:bg-red-500/30 text-emerald-200 hover:text-red-300 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>

      {/* Image */}
      <div className="bg-[#1a2e22] border-x border-b border-[#2e5e3a] rounded-b-xl p-2">
        {data.imageUrl ? (
          <img src={data.imageUrl} alt="参考图" className="w-full rounded-lg object-cover max-h-[160px]" />
        ) : (
          <div className="h-20 flex items-center justify-center">
            <Image size={24} className="text-zinc-700" />
          </div>
        )}
      </div>

      {/* Handle */}
      <Handle type="source" position={Position.Right}
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-[#1a2e22] !shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
    </div>
  );
}
