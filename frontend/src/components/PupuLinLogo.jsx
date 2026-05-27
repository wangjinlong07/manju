import React from 'react';

/**
 * PupuLin Brand Logo — 参考原型图 pilipulu 的双环 P 图标 + 现代无衬线字体设计
 * 
 * Props:
 *   size     — 图标高度 (px), 默认 28
 *   showText — 是否显示文字，默认 true
 *   className — 额外 className
 *   subtitle — 右侧副标题，如 "AI剧创作"
 */
export default function PupuLinLogo({ size = 28, showText = true, className = '', subtitle = '' }) {
  const iconW = size;
  const iconH = size;
  const textScale = size / 28;

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Icon: 双环 P 图标 — 参考原型 pilipulu 的圆润气泡风格 */}
      <svg width={iconW} height={iconH} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pupulin-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        {/* 外圆：品牌主色气泡 */}
        <circle cx="16" cy="16" r="15" fill="url(#pupulin-icon-grad)" />
        {/* 内部 P 字母 — 圆润几何风格 */}
        <path
          d="M 11 8 L 11 24 L 14 24 L 14 19 L 18 19 C 21.5 19 24 16.5 24 13.5 C 24 10.5 21.5 8 18 8 L 11 8 Z M 14 11 L 17.5 11 C 19.5 11 21 12.2 21 13.5 C 21 14.8 19.5 16 17.5 16 L 14 16 L 14 11 Z"
          fill="white"
          opacity="0.95"
        />
        {/* 装饰：小气泡圆点 — 呼应 "噗噗" 的气泡意象 */}
        <circle cx="24" cy="7" r="2.5" fill="white" opacity="0.3" />
        <circle cx="27" cy="11" r="1.5" fill="white" opacity="0.2" />
      </svg>

      {/* Text: PupuLin 现代无衬线字体 */}
      {showText && (
        <div className="flex items-baseline gap-0" style={{ fontSize: `${18 * textScale}px` }}>
          <span
            className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif" }}
          >
            Pupu
          </span>
          <span
            className="font-bold tracking-tight text-indigo-500 dark:text-indigo-400"
            style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif" }}
          >
            Lin
          </span>
          {subtitle && (
            <>
              <span className="mx-2 w-px h-4 bg-zinc-300 dark:bg-zinc-700 inline-block self-center" />
              <span
                className="text-zinc-500 dark:text-zinc-400 font-medium"
                style={{
                  fontSize: `${14 * textScale}px`,
                  fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif",
                }}
              >
                {subtitle}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}