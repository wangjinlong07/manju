import React from 'react';

export default function PupuLinLogo({ size = 36, className = "" }) {
  return (
    <svg 
      width={size * (140 / 36)} 
      height={size} 
      viewBox="0 0 140 36" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
    >
      <defs>
        <linearGradient id="proBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" /> {/* purple-500 */}
          <stop offset="50%" stopColor="#6366f1" /> {/* indigo-500 */}
          <stop offset="100%" stopColor="#3b82f6" /> {/* blue-500 */}
        </linearGradient>
      </defs>

      {/* 动态重叠面板图标 */}
      <g transform="translate(0, 4)">
        {/* 后置玻璃切片：浅色模式变灰，暗色模式变深灰 */}
        <path 
          className="fill-zinc-300 dark:fill-zinc-700 transition-colors duration-300"
          d="M 6 0 L 20 0 C 22 0 23 1 22.5 2.5 L 16 22 C 15.5 23.5 14 24 12 24 L 2 24 C 0 24 -0.5 23 0.5 21.5 L 4 2.5 C 4.5 1 6 0 8 0 Z" 
          opacity="0.6"
        />
        {/* 前置高光主题切片 (渐变色保持不变，维持品牌锚点) */}
        <path 
          d="M 12 4 L 28 4 C 30 4 31 5 30.5 6.5 L 24 26 C 23.5 27.5 22 28 20 28 L 8 28 C 6 28 5.5 27 6.5 25.5 L 10 6.5 C 10.5 5 12 4 14 4 Z" 
          fill="url(#proBrandGrad)"
        />
        {/* 内部极简锐利的播放/星火剪影 */}
        <path 
          d="M 19 12 L 23 16 L 18 19 Z" 
          fill="#ffffff" 
          opacity="0.9"
        />
      </g>

      {/* 高级无衬线斜体排版 */}
      <text 
        x="38" 
        y="26" 
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
        fontSize="22" 
        fontWeight="900" 
        fontStyle="italic" 
        letterSpacing="-0.04em"
      >
        {/* 核心修复：Pupu 字样在浅色模式下为深黑，暗色模式下为亮白 */}
        <tspan className="fill-zinc-900 dark:fill-zinc-100 transition-colors duration-300">Pupu</tspan>
        {/* Lin 字样永久保持品牌渐变色 */}
        <tspan fill="url(#proBrandGrad)">Lin</tspan>
      </text>
    </svg>
  );
}