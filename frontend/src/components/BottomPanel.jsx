import { useState, useEffect, useMemo } from 'react';
import { useReactFlow, useStore } from 'reactflow';
import { 
  X, Cpu, Check, Play, Image as ImageIcon, Clapperboard
} from 'lucide-react';
import { useCanvasStore } from '../store/canvas';
import { useThemeStore } from '../store/theme';
import { useProjectStore } from '../store/project';

const API_BASE = '/api';

export default function BottomPanel({ selectedNode, onUpdateNodeData, onClose, getUpstreamData }) {
  const { getEdges, setEdges, getNodes, setNodes } = useReactFlow();
  const { theme } = useThemeStore();
  const { models } = useCanvasStore();
  const { currentProject } = useProjectStore();
  const isDark = theme === 'dark';

  const nodeType = selectedNode?.type;
  const nodeData = selectedNode?.data || {};

  // Local state for Gacha Node (图像生成)
  const [gachaPrompt, setGachaPrompt] = useState('');
  const [gachaProvider, setGachaProvider] = useState('');
  const gachaRatio = currentProject?.ratio || '16:9';
  const [gachaResolution, setGachaResolution] = useState('2K');
  const [gachaCount, setGachaCount] = useState(4);
  const [gachaSkill, setGachaSkill] = useState('');

  // Local state for Video Node (视频渲染)
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoProvider, setVideoProvider] = useState('');
  const [videoDuration, setVideoDuration] = useState('5');
  const [videoMode, setVideoMode] = useState('image2video');
  const [videoSkill, setVideoSkill] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Retrieve upstream connected data dynamically
  const upstream = useMemo(() => {
    if (!selectedNode) return {};
    return getUpstreamData(selectedNode.id);
  }, [selectedNode?.id, getUpstreamData]);

  // Sync state values when selectedNode changes
  useEffect(() => {
    if (selectedNode) {
      setError(null);
      if (nodeType === 'gachaNode') {
        setGachaPrompt(nodeData.prompt || '');
        setGachaProvider(nodeData.provider || 'flux-schnell');
        setGachaResolution(nodeData.resolution || '2K');
        setGachaCount(nodeData.count || 4);
        setGachaSkill(nodeData.skill || '');
      } else if (nodeType === 'videoNode') {
        setVideoPrompt(nodeData.prompt || '');
        setVideoProvider(nodeData.provider || 'cogvideox3');
        setVideoDuration(nodeData.duration || '5');
        setVideoMode(nodeData._mode || 'image2video');
        setVideoSkill(nodeData.skill || '');
      }
    }
  }, [selectedNode?.id, nodeType]);

  // Model lists
  const providerList = useMemo(() => {
    if (nodeType === 'gachaNode') return models.image || [];
    if (nodeType === 'videoNode') return models.video || [];
    return [];
  }, [nodeType, models]);

  // Skill lists
  const skillList = useMemo(() => {
    if (nodeType === 'gachaNode') return models.skills?.image || [];
    if (nodeType === 'videoNode') return models.skills?.video || [];
    return [];
  }, [nodeType, models]);



  // Node details mapping
  const { icon: NodeIcon, color: nodeColor, title: nodeTitle } = useMemo(() => {
    if (nodeType === 'gachaNode') return { icon: ImageIcon, color: 'text-sky-400', title: '图像生成' };
    if (nodeType === 'videoNode') return { icon: Clapperboard, color: 'text-indigo-400', title: '视频渲染' };
    return { icon: Cpu, color: 'text-zinc-400', title: '节点配置' };
  }, [nodeType]);

  // Sync back local inputs to nodeData in canvas
  const updateNodeDataField = (field, value) => {
    onUpdateNodeData(selectedNode.id, { [field]: value });
  };

  // ─────────────────────────────────────────────
  // Action triggers
  // ─────────────────────────────────────────────

  const handleGenerate = async () => {
    if (nodeType === 'gachaNode' && !gachaPrompt.trim()) {
      setError('提示词描述不能为空');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (nodeType === 'gachaNode') {
        const payload = {
          scene_id: `gacha-${Date.now()}`,
          prompt: gachaPrompt,
          image_provider: gachaProvider,
          n: Number(gachaCount),
          skill: gachaSkill,
          ratio: gachaRatio,
          resolution: gachaResolution,
          project_id: currentProject?.id || '',
          reference_images: upstream.imageUrls && upstream.imageUrls.length > 0 
            ? upstream.imageUrls 
            : (upstream.imageUrl ? [upstream.imageUrl] : []),
        };
        const res = await fetch(`${API_BASE}/scene/gacha`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const urls = data.image_urls || [];
        const output = { scene_id: payload.scene_id, image_url: urls[0], image_urls: urls };
        onUpdateNodeData(selectedNode.id, { 
          output, 
          prompt: gachaPrompt, 
          provider: gachaProvider, 
          ratio: gachaRatio, 
          resolution: gachaResolution, 
          count: Number(gachaCount), 
          skill: gachaSkill 
        });
        selectedNode.data.propagateData?.(selectedNode.id, output);
      } else if (nodeType === 'videoNode') {
        if (videoMode !== 'text2video' && !upstream.imageUrl) {
          setError('连线输入底图丢失，请先连接上游图片节点');
          setLoading(false);
          return;
        }
        const payload = {
          scene_id: `video-${Date.now()}`,
          image_url: videoMode !== 'text2video' ? upstream.imageUrl : undefined,
          video_provider: videoProvider,
          duration: Number(videoDuration),
          prompt: videoPrompt || '高质量电影级视频',
          motion_type: videoMode,
          project_id: currentProject?.id || '',
        };
        const res = await fetch(`${API_BASE}/scene/render_video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const output = { video_url: data.video_url, scene_id: payload.scene_id };
        onUpdateNodeData(selectedNode.id, { 
          output, 
          prompt: videoPrompt, 
          provider: videoProvider, 
          _mode: videoMode, 
          duration: videoDuration, 
          skill: videoSkill 
        });
        selectedNode.data.propagateData?.(selectedNode.id, output);
      }
    } catch (e) {
      console.error(e);
      setError('操作执行失败，请检查网络或后端状态');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveImage = async (url) => {
    if (!selectedNode.data.output?.scene_id) return;
    try {
      await fetch(`${API_BASE}/scene/approve_image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene_id: selectedNode.data.output.scene_id, image_url: url }),
      });
    } catch (e) {
      console.error('[ApproveImage] Failed:', e);
    }
    const newOutput = { ...selectedNode.data.output, image_url: url };
    onUpdateNodeData(selectedNode.id, { output: newOutput });
    selectedNode.data.propagateData?.(selectedNode.id, newOutput);
  };

  const handleRemoveUpstreamImage = (targetImageUrl) => {
    const currentEdges = getEdges();
    const currentNodes = getNodes();
    const edgeToRemove = currentEdges.find(edge => {
      if (edge.target !== selectedNode.id) return false;
      const sourceNode = currentNodes.find(n => n.id === edge.source);
      if (!sourceNode) return false;
      const imageUrl = sourceNode.data?.output?.image_url || sourceNode.data?.imageUrl;
      return imageUrl === targetImageUrl;
    });

    if (edgeToRemove) {
      setEdges(eds => eds.filter(e => e.id !== edgeToRemove.id));
      setNodes(nds => nds.map(n => {
        if (n.id === selectedNode.id) {
          const otherIncomingEdges = currentEdges.filter(e => e.target === selectedNode.id && e.id !== edgeToRemove.id);
          if (otherIncomingEdges.length === 0) {
            return { ...n, data: { ...n.data, inputData: undefined } };
          } else {
            const firstRemainingEdge = otherIncomingEdges[0];
            const remainingSourceNode = currentNodes.find(sn => sn.id === firstRemainingEdge.source);
            const remainingImageUrl = remainingSourceNode?.data?.output?.image_url || remainingSourceNode?.data?.imageUrl;
            const remainingOutput = remainingSourceNode?.data?.output || (remainingImageUrl ? { image_url: remainingImageUrl } : null);
            return { ...n, data: { ...n.data, inputData: remainingOutput } };
          }
        }
        return n;
      }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const pillStyle = `h-7 px-3.5 rounded-full border outline-none cursor-pointer transition-all shrink-0 font-sans text-[11px] ${
    isDark 
      ? 'bg-zinc-800/80 border-zinc-700/60 hover:border-zinc-650 hover:bg-zinc-800 text-zinc-300' 
      : 'bg-zinc-100 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-200/85 text-zinc-600'
  }`;

  const outputData = selectedNode?.data?.output || {};
  const isGacha = nodeType === 'gachaNode';
  const isVideo = nodeType === 'videoNode';

  if (!isGacha && !isVideo) {
    return (
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-[150] w-[660px] flex flex-col border shadow-[0_24px_70px_rgba(0,0,0,0.85)] rounded-2xl p-4 ${
          isDark ? 'bg-[#151722]/95 border-[#282d3d]/90 text-zinc-100 backdrop-blur-2xl' : 'bg-white/95 border-zinc-200 text-zinc-800 backdrop-blur-2xl'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NodeIcon size={12} className={nodeColor} />
            <span className="text-xs font-bold text-zinc-550 dark:text-zinc-400">{nodeTitle}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <X size={13} />
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-2">
          {nodeType === 'localImageNode' ? '本地参考图节点已选中。通过连接到生图节点的输入端，可用作画风及人像特征参考底图。' : '此节点暂无进阶配置项。'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-[150] w-[660px] flex flex-col border transition-all duration-300 shadow-[0_24px_70px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.85)] rounded-2xl ${
        isDark 
          ? 'bg-[#151722]/95 border-[#282d3d]/90 text-zinc-100 backdrop-blur-2xl' 
          : 'bg-white/95 border-zinc-250/90 text-zinc-850 backdrop-blur-2xl'
      }`}
      onKeyDown={(e) => e.stopPropagation()} 
    >
      {/* 1. Header (Compact overlay bar) */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 border-b border-zinc-200 dark:border-zinc-800/40 shrink-0">
        <div className="flex items-center gap-2">
          <NodeIcon size={12} className={nodeColor} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{nodeTitle}配置</span>
          <span className="text-[9px] text-zinc-400 dark:text-zinc-600 font-mono">#{selectedNode.id}</span>
        </div>
        {error && (
          <span className="text-[10px] text-red-500 dark:text-red-400 font-medium px-2 py-0.5 rounded bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 max-w-[280px] truncate">
            {error}
          </span>
        )}
        <button
          onClick={onClose}
          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* 2. Top reference / candidate images row */}
      {isGacha && outputData.image_urls?.length > 0 && (
        <div className="px-4 pt-2.5 flex flex-col gap-1 shrink-0">
          <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold tracking-wider">候选图 · 点击采纳</span>
          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
            {outputData.image_urls.map((url, idx) => {
              const isApproved = url === outputData.image_url;
              return (
                <div 
                  key={idx} 
                  onClick={() => handleApproveImage(url)}
                  className={`relative w-20 h-12 rounded-lg overflow-hidden border cursor-pointer shrink-0 transition-all ${
                    isApproved 
                      ? 'border-sky-500 ring-2 ring-sky-500/35 scale-[0.98]' 
                      : 'border-zinc-200 dark:border-zinc-850 hover:border-zinc-350 dark:hover:border-zinc-700'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover bg-zinc-100 dark:bg-zinc-950" />
                  {isApproved && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-sky-500 flex items-center justify-center text-white border border-zinc-900 shadow">
                      <Check size={9} strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {((upstream.imageUrls && upstream.imageUrls.length > 0) || upstream.imageUrl) && (
        <div className="px-4 pt-2.5 flex flex-col gap-1 shrink-0">
          <span className="text-[9px] text-zinc-450 dark:text-zinc-500 font-semibold tracking-wider font-sans">
            {isGacha ? '连线参考图' : '连线输入底图'}
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {upstream.imageUrls && upstream.imageUrls.length > 0 ? (
              upstream.imageUrls.map((url, idx) => (
                <div key={idx} className="relative group w-20 h-12 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-850 shrink-0">
                  <img src={url} alt="" className="w-full h-full object-cover bg-zinc-100 dark:bg-zinc-950" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveUpstreamImage(url); }}
                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 hover:bg-red-500 flex items-center justify-center text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow"
                    title="断开连线"
                  >
                    ×
                  </button>
                </div>
              ))
            ) : (
              <div className="relative group w-20 h-12 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-850 shrink-0">
                <img src={upstream.imageUrl} alt="" className="w-full h-full object-cover bg-zinc-100 dark:bg-zinc-950" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemoveUpstreamImage(upstream.imageUrl); }}
                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 hover:bg-red-500 flex items-center justify-center text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow"
                  title="断开连线"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Textarea Prompt Input (Borderless style) */}
      <div className="px-4 pt-2.5 pb-1 relative shrink-0">
        <textarea
          value={isGacha ? gachaPrompt : videoPrompt}
          onChange={(e) => {
            const val = e.target.value;
            if (isGacha) {
              setGachaPrompt(val);
              updateNodeDataField('prompt', val);
            } else {
              setVideoPrompt(val);
              updateNodeDataField('prompt', val);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isGacha 
              ? '融合以上参考图风格，进一步丰富画面细节描述...'
              : '输入视频运动描述提示词...'
          }
          className="w-full bg-transparent text-[13px] text-zinc-800 dark:text-zinc-200 outline-none resize-none h-[60px] leading-relaxed placeholder-zinc-400 dark:placeholder-zinc-650 focus:ring-0 border-b border-zinc-200 dark:border-zinc-800/40 pb-1.5"
        />
      </div>

      {/* 4. Bottom Row Settings Badges + Action Button */}
      <div className="flex items-center justify-between gap-3 px-4 pb-4 shrink-0 mt-1">
        {/* Left Side: Selectors (Horizontal Scrollable Container to prevent overflow) */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none min-w-0 flex-1 pr-2">
          {/* Model selection pill */}
          {providerList.length > 0 && (
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-full px-2.5 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-300 shrink-0">
              <Cpu size={10} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
              <select
                value={isGacha ? gachaProvider : videoProvider}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isGacha) {
                    setGachaProvider(val);
                    updateNodeDataField('provider', val);
                  } else {
                    setVideoProvider(val);
                    updateNodeDataField('provider', val);
                  }
                }}
                className="bg-transparent border-none outline-none text-[11px] text-zinc-600 dark:text-zinc-300 cursor-pointer pr-1 font-medium font-sans"
              >
                {providerList.map((m) => (
                  <option key={m.id} value={m.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">{m.display_name}</option>
                ))}
              </select>
            </div>
          )}
          {/* Gacha Node dropdowns */}
          {isGacha && (
            <>
              <select
                value={gachaCount}
                onChange={(e) => {
                  setGachaCount(Number(e.target.value));
                  updateNodeDataField('count', Number(e.target.value));
                }}
                className={pillStyle}
              >
                <option value={1} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">抽卡: 1张</option>
                <option value={2} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">抽卡: 2张</option>
                <option value={4} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">抽卡: 4张</option>
                <option value={8} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">抽卡: 8张</option>
              </select>

              {skillList.length > 0 && (
                <select
                  value={gachaSkill}
                  onChange={(e) => {
                    setGachaSkill(e.target.value);
                    updateNodeDataField('skill', e.target.value);
                  }}
                  className={pillStyle}
                >
                  <option value="" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">默认画风</option>
                  {skillList.map((sk) => (
                    <option key={sk.id} value={sk.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">{sk.display_name}</option>
                  ))}
                </select>
              )}
            </>
          )}

          {/* Video Node dropdowns */}
          {isVideo && (
            <>
              <select
                value={videoMode}
                onChange={(e) => {
                  setVideoMode(e.target.value);
                  updateNodeDataField('_mode', e.target.value);
                }}
                className={pillStyle}
              >
                <option value="image2video" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">图生视频</option>
                <option value="text2video" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">文生视频</option>
                <option value="first_last_frame" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">首尾关键帧</option>
              </select>

              <select
                value={videoDuration}
                onChange={(e) => {
                  setVideoDuration(e.target.value);
                  updateNodeDataField('duration', e.target.value);
                }}
                className={pillStyle}
              >
                <option value="5" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">时长: 5s</option>
                <option value="10" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">时长: 10s</option>
              </select>

              {skillList.length > 0 && (
                <select
                  value={videoSkill}
                  onChange={(e) => {
                    setVideoSkill(e.target.value);
                    updateNodeDataField('skill', e.target.value);
                  }}
                  className={pillStyle}
                >
                  <option value="" className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">默认运镜</option>
                  {skillList.map((sk) => (
                    <option key={sk.id} value={sk.id} className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100">{sk.display_name}</option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>

        {/* Right Side: Token info and Action Trigger button (Protected shrink-0) */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">


          <button
            onClick={handleGenerate}
            disabled={loading}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg transition-all active:scale-[0.97] hover:scale-[1.02] disabled:opacity-40 disabled:pointer-events-none shrink-0 ${
              isGacha 
                ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/10' 
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10'
            }`}
          >
            {loading ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play size={11} fill="currentColor" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
