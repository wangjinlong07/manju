import React from 'react';
import { X } from 'lucide-react';

/**
 * 通用设置弹出面板 — 浮在节点旁边
 * children 由调用方传入具体表单内容
 */
export default function SettingsPopover({ title, onClose, children, position }) {
  return (
    <div
      className="fixed z-[200] w-[280px] rounded-xl bg-zinc-900/95 border border-zinc-700/60 backdrop-blur-xl shadow-[0_12px_48px_rgba(0,0,0,0.8)]"
      style={{ top: position?.y || 100, left: position?.x || 100 }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-[11px] font-semibold text-zinc-200">{title}</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
          <X size={13} />
        </button>
      </div>
      <div className="p-3 space-y-2 nowheel nodrag max-h-[300px] overflow-y-auto" onWheel={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
