import { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, useReactFlow, useStore } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import { Clapperboard, Send, Download } from 'lucide-react';

const API_BASE = "/api";

export default function VideoNode({ id, data, selected }) {
  const videoUrl = data.output?.video_url || null;
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [provider, setProvider] = useState(data.provider || 'cogvideox3');
  const [duration, setDuration] = useState(data.duration || '5');
  const [mode, setMode] = useState(data._mode || 'image2video');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [skills, setSkills] = useState([]);
  const [inputImage, setInputImage] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showRefPicker, setShowRefPicker] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(data.skill || '');
  const [refImages, setRefImages] = useState([]);
  const { setNodes, getNode } = useReactFlow();
  const edges = useStore(s => s.edges);
  const textareaRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/models`).then(r => r.json()).then(d => {
      setModels(d.video || []);
      setSkills(d.skills?.video || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const incoming = edges.filter(e => e.target === id);
    const imgs = [];
    for (const edge of incoming) {
      const src = getNode(edge.source);
      if (src?.data?.output?.image_url) {
        setInputImage(src.data.output.image_url);
        imgs.push(src.data.output.image_url);
      }
    }
    setRefImages(imgs);
    if (!imgs.length) setInputImage(null);
  }, [edges, id, getNode, data.inputData]);

  const handleTextChange = useCallback((e) => {
    const val = e.target.value;
    const lastChar = val[e.target.selectionStart - 1];
    setPrompt(val);
    if (lastChar === '/') setShowSkillPicker(true);
    else setShowSkillPicker(false);
    if (lastChar === '@') setShowRefPicker(true);
    else setShowRefPicker(false);
  }, []);

  const insertSkill = useCallback((skill) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = prompt.slice(0, pos - 1);
    const after = prompt.slice(pos);
    const insert = `/${skill.id} `;
    setPrompt(before + insert + after);
    setSelectedSkill(skill.id);
    setShowSkillPicker(false);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = before.length + insert.length; }, 0);
  }, [prompt]);

  const insertRef = useCallback((idx) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = prompt.slice(0, pos - 1);
    const after = prompt.slice(pos);
    const insert = `@参考图${idx + 1} `;
    setPrompt(before + insert + after);
    setShowRefPicker(false);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = before.length + insert.length; }, 0);
  }, [prompt]);

  const handleSend = useCallback(async () => {
    setLoading(true);
    const payload = { scene_id: `video-${Date.now()}`, image_url: mode !== 'text2video' ? inputImage : undefined, video_provider: provider, duration: Number(duration), prompt: prompt || '高质量电影级视频', motion_type: mode, project_id: data.projectId || '' };
    console.log('[VideoNode] API 调用参数:', JSON.stringify(payload, null, 2));
    try {
      const res = await fetch(`${API_BASE}/scene/render_video`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      console.log('[VideoNode] 生成结果:', result.video_url);
      const output = { video_url: result.video_url };
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, output, prompt, provider, _mode: mode, duration, skill: selectedSkill } } : n));
      data.propagateData?.(id, output);
    } catch (e) { console.error('[VideoNode] 错误:', e); } finally { setLoading(false); }
  }, [inputImage, provider, duration, prompt, mode, id, setNodes, data, selectedSkill]);

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `video-${Date.now()}.mp4`;
    a.click();
  };

  return (
    <div className="relative w-full h-fit" style={{ overflow: 'visible', minWidth: 280 }}>
      {selected && <NodeResizer minWidth={180} minHeight={100} isVisible={true} keepAspectRatio={true} lineClassName="!border-indigo-500/50" handleClassName="!w-2 !h-2 !bg-indigo-500 !border-none" />}
      {/* ─── Video Card ─── */}
      <div
        className={`relative w-full rounded-2xl overflow-hidden transition-shadow ${selected ? 'shadow-[0_0_30px_rgba(99,102,241,0.25)]' : 'shadow-xl'}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {loading && (
          <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center rounded-2xl">
            <div className="w-8 h-8 border-3 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          </div>
        )}
        {hovered && videoUrl && (
          <button onClick={handleDownload} className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all">
            <Download size={14} />
          </button>
        )}
        {videoUrl ? (
          <video src={videoUrl} autoPlay loop muted className="w-full rounded-2xl object-cover bg-zinc-900" />
        ) : inputImage ? (
          <div className="relative w-full min-h-[160px]">
            <img src={inputImage} alt="" className="w-full rounded-2xl object-cover bg-zinc-900 opacity-40" />
            <Clapperboard size={28} className="absolute inset-0 m-auto text-indigo-400/50" />
          </div>
        ) : (
          <div className="w-full min-h-[160px] bg-zinc-900 rounded-2xl flex items-center justify-center">
            <Clapperboard size={32} className="text-zinc-800" />
          </div>
        )}
      </div>
      {/* Handles outside overflow-hidden card */}
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-sky-500 !border-2 !border-zinc-900" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-zinc-900" />

      {/* ─── Input Bar (absolute, below node) ─── */}
      {selected && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-fit rounded-2xl bg-[#1c2333] border border-[#2a3a50] shadow-2xl nowheel nodrag"
          onWheel={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Row 1: Upstream image thumbnail */}
          {inputImage && (
            <div className="flex items-center gap-2 px-4 pt-3">
              <img src={inputImage} alt="" className="w-11 h-11 rounded-xl object-cover border border-zinc-700" />
            </div>
          )}
          {/* Row 2: Textarea with / and @ triggers */}
          <div className="px-4 pt-3 pb-2 relative">
            <textarea ref={textareaRef} value={prompt} onChange={handleTextChange}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              className="w-full bg-transparent text-[13px] text-zinc-200 outline-none resize-none min-h-[110px] max-h-[110px] overflow-y-auto leading-relaxed placeholder-zinc-600"
              placeholder="输入视频运动描述... 输入 / 唤起风格 · @ 引用参考图"
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'; }} />
            {/* Skill picker popup */}
            {showSkillPicker && skills.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 max-h-40 overflow-y-auto rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl z-60">
                {skills.map(s => (
                  <button key={s.id} onClick={() => insertSkill(s)}
                    className="w-full text-left px-3 py-2 text-[12px] text-zinc-300 hover:bg-indigo-500/15 hover:text-indigo-300 transition-colors">
                    /{s.id} <span className="text-zinc-500 ml-1">{s.display_name}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Ref image picker popup */}
            {showRefPicker && refImages.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl z-60 p-2 flex gap-2">
                {refImages.map((url, i) => (
                  <button key={i} onClick={() => insertRef(i)} className="flex flex-col items-center gap-1 hover:opacity-80">
                    <img src={url} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-600" />
                    <span className="text-[10px] text-zinc-400">参考图{i + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Row 3: Pills + Send */}
          <div className="flex items-center px-4 pb-3">
            <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
            <select value={provider} onChange={e => setProvider(e.target.value)}
              className="h-7 px-3 rounded-full bg-[#253040] text-[12px] text-zinc-300 outline-none border-none appearance-none cursor-pointer">
              {models.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
            {['image2video', 'text2video', 'first_last_frame'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`h-7 px-3 rounded-full text-[12px] transition-all ${mode === m ? 'bg-indigo-500/25 text-indigo-300' : 'bg-[#253040] text-zinc-300'}`}>
                {m === 'image2video' ? '图生视频' : m === 'text2video' ? '文生视频' : '首尾帧'}
              </button>
            ))}
            <select value={duration} onChange={e => setDuration(e.target.value)}
              className="h-7 px-3 rounded-full bg-[#253040] text-[12px] text-zinc-300 outline-none border-none appearance-none cursor-pointer">
              <option value="5">5s</option><option value="10">10s</option>
            </select>
            {selectedSkill && (
              <span className="h-7 flex items-center px-3 rounded-full bg-indigo-500/15 text-[12px] text-indigo-300">
                /{selectedSkill}
              </span>
            )}
            </div>
            <div className="flex-1 min-w-[100px]" />
            <button onClick={handleSend} disabled={loading || (mode !== 'text2video' && !inputImage)}
              className="shrink-0 w-9 h-9 rounded-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 flex items-center justify-center text-white transition-all">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
