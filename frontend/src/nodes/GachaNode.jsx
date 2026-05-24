import { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, useReactFlow, useStore } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import { Image, Send, Download, Link2 } from 'lucide-react';

const API_BASE = "/api";

function sceneToText(scene) {
  if (!scene) return '';
  const lines = [];
  if (scene.scene_description) lines.push(`· 场景：${scene.scene_description}`);
  if (scene.character_name || scene.character_appearance) lines.push(`· 角色：${[scene.character_name, scene.character_appearance].filter(Boolean).join('，')}`);
  if (scene.dialogue) lines.push(`· 台词：${scene.dialogue}`);
  const desc = scene.image_prompt_cn || scene.image_prompt || '';
  if (desc) lines.push(`· 画面：${desc}`);
  if (scene.shot_type) lines.push(`· 镜头：${scene.shot_type}`);
  return lines.join('\n');
}

export default function GachaNode({ id, data, selected }) {
  const currentImage = data.output?.image_url || null;
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [provider, setProvider] = useState(data.provider || 'flux-schnell');
  const [ratio, setRatio] = useState(data.ratio || '16:9');
  const [resolution, setResolution] = useState(data.resolution || '2K');
  const [count, setCount] = useState(data.count || 4);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [skills, setSkills] = useState([]);
  const [hovered, setHovered] = useState(false);
  const { setNodes, getNode } = useReactFlow();
  const edges = useStore(s => s.edges);
  const [refImages, setRefImages] = useState([]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showRefPicker, setShowRefPicker] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(data.skill || '');
  const textareaRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/models`).then(r => r.json()).then(d => {
      setModels(d.image || []);
      setSkills(d.skills?.image || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const incoming = edges.filter(e => e.target === id);
    const imgs = [];
    for (const edge of incoming) {
      const src = getNode(edge.source);
      if (!src?.data?.output) continue;
      if (src.type === 'localImageNode' && src.data.output.image_url) imgs.push(src.data.output.image_url);
      if (src.type === 'gachaNode' && src.data.output.image_url) imgs.push(src.data.output.image_url);
      const out = src.data.output;
      if (Array.isArray(out) && out.length > 0 && !prompt) setPrompt(sceneToText(out[0]));
    }
    setRefImages(imgs);
  }, [edges, id, getNode]);

  useEffect(() => {
    if (data.inputData?.scene) setPrompt(sceneToText(data.inputData.scene));
    else if (data.inputData?.image_prompt) setPrompt(data.inputData.image_prompt);
    else if (data.inputData?.text) setPrompt(data.inputData.text);
    else if (Array.isArray(data.inputData) && data.inputData[0]) setPrompt(sceneToText(data.inputData[0]));
  }, [data.inputData]);

  // / 和 @ 检测
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
    // 替换光标前的 / 字符为 /skillId + 空格
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
    // 替换光标前的 @ 字符为 @参考图N + 空格
    const before = prompt.slice(0, pos - 1);
    const after = prompt.slice(pos);
    const insert = `@参考图${idx + 1} `;
    setPrompt(before + insert + after);
    setShowRefPicker(false);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = before.length + insert.length; }, 0);
  }, [prompt]);

  const handleSend = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    const sceneId = `gacha-${Date.now()}`;
    const payload = { scene_id: sceneId, prompt, image_provider: provider, n: count, skill: selectedSkill, ratio, resolution, project_id: data.projectId || '', reference_images: refImages };
    console.log('[GachaNode] API 调用参数:', JSON.stringify(payload, null, 2));
    try {
      const res = await fetch(`${API_BASE}/scene/gacha`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const urls = result.image_urls || [];
      console.log('[GachaNode] 生成结果:', urls);
      const output = { scene_id: sceneId, image_url: urls[0], image_urls: urls };
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, output, prompt, provider, ratio, resolution, count, skill: selectedSkill } } : n));
      data.propagateData?.(id, output);
    } catch (e) { console.error('[GachaNode] 错误:', e); } finally { setLoading(false); }
  }, [prompt, refImages, provider, count, ratio, resolution, id, setNodes, data, selectedSkill]);

  const handleDownload = () => {
    if (!currentImage) return;
    const a = document.createElement('a');
    a.href = currentImage;
    a.download = `gacha-${Date.now()}.png`;
    a.click();
  };

  const handleNineView = useCallback(async () => {
    if (!currentImage) return;
    setLoading(true);
    const payload = { scene_id: `9view-${Date.now()}`, prompt: `基于这张图片生成3x3九宫格多角度视图，保持角色/场景完全一致，包含正面、侧面、背面、俯视、仰视等多角度`, image_provider: provider, n: 1, skill: '', ratio: '1:1', resolution: '2K', project_id: data.projectId || '', reference_images: [currentImage] };
    console.log('[GachaNode] 九视图 API:', JSON.stringify(payload, null, 2));
    try {
      const res = await fetch(`${API_BASE}/scene/gacha`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const urls = result.image_urls || [];
      if (urls[0]) {
        const output = { ...data.output, nine_view_url: urls[0] };
        setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, output } } : n));
      }
    } catch (e) { console.error('[GachaNode] 九视图错误:', e); } finally { setLoading(false); }
  }, [currentImage, provider, id, setNodes, data]);

  return (
    <div className="relative w-full h-fit" style={{ overflow: 'visible', minWidth: 280 }}>
      {selected && <NodeResizer minWidth={180} minHeight={100} isVisible={true} keepAspectRatio={true} lineClassName="!border-sky-500/50" handleClassName="!w-2 !h-2 !bg-sky-500 !border-none" />}
      {/* ─── Image Card ─── */}
      <div
        className={`relative w-full rounded-2xl overflow-hidden transition-shadow ${selected ? 'shadow-[0_0_30px_rgba(56,189,248,0.25)]' : 'shadow-xl'}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {loading && (
          <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center rounded-2xl">
            <div className="w-8 h-8 border-3 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
          </div>
        )}
        {hovered && currentImage && (
          <button onClick={handleDownload} className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all">
            <Download size={14} />
          </button>
        )}
        {currentImage ? (
          <img src={currentImage} alt="" className="w-full rounded-2xl object-cover bg-zinc-900" />
        ) : (
          <div className="w-full min-h-[160px] bg-zinc-900 rounded-2xl flex items-center justify-center">
            <Image size={32} className="text-zinc-800" />
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
          {/* Row 1: Reference images + 候选图选择 */}
          {data.output?.image_urls?.length > 1 && (
            <div className="px-4 pt-3">
              <p className="text-[10px] text-zinc-500 mb-1.5">候选图 · 点击选中</p>
              <div className="grid grid-cols-4 gap-1.5">
                {data.output.image_urls.map((url, i) => (
                  <img key={i} src={url} alt="" onClick={() => {
                    const output = { ...data.output, image_url: url };
                    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, output } } : n));
                    data.propagateData?.(id, output);
                  }}
                    className={`w-full aspect-square object-cover rounded-lg cursor-pointer transition-all ${url === currentImage ? 'ring-2 ring-sky-400' : 'opacity-60 hover:opacity-100'}`} />
                ))}
              </div>
            </div>
          )}
          {refImages.length > 0 && (
            <div className="flex items-center gap-2 px-4 pt-3">
              {refImages.map((url, i) => (
                <img key={i} src={url} alt="" className="w-11 h-11 rounded-xl object-cover border border-zinc-700" />
              ))}
            </div>
          )}
          {/* Row 2: Textarea with / and @ triggers */}
          <div className="px-4 pt-3 pb-2 relative">
            <textarea ref={textareaRef} value={prompt} onChange={handleTextChange}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              className="w-full bg-transparent text-[13px] text-zinc-200 outline-none resize-none min-h-[110px] max-h-[110px] overflow-y-auto leading-relaxed placeholder-zinc-600"
              placeholder="· 输入 / 唤起风格  · 输入 @ 引用参考图&#10;· 场景：xxx&#10;· 角色：xxx"
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'; }} />
            {/* Skill picker popup */}
            {showSkillPicker && skills.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 max-h-40 overflow-y-auto rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl z-60">
                {skills.map(s => (
                  <button key={s.id} onClick={() => insertSkill(s)}
                    className="w-full text-left px-3 py-2 text-[12px] text-zinc-300 hover:bg-sky-500/15 hover:text-sky-300 transition-colors">
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
            <select value={ratio} onChange={e => setRatio(e.target.value)}
              className="h-7 px-3 rounded-full bg-[#253040] text-[12px] text-zinc-300 outline-none border-none appearance-none cursor-pointer">
              <option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:3">4:3</option>
            </select>
            <select value={resolution} onChange={e => setResolution(e.target.value)}
              className="h-7 px-3 rounded-full bg-[#253040] text-[12px] text-zinc-300 outline-none border-none appearance-none cursor-pointer">
              <option value="2K">2K</option><option value="4K">4K</option>
            </select>
            <select value={count} onChange={e => setCount(Number(e.target.value))}
              className="h-7 px-3 rounded-full bg-[#253040] text-[12px] text-zinc-300 outline-none border-none appearance-none cursor-pointer">
              <option value={1}>1张</option><option value={2}>2张</option><option value={4}>4张</option><option value={8}>8张</option>
            </select>
            {refImages.length > 0 && (
              <span className="h-7 flex items-center gap-1 px-3 rounded-full bg-[#253040] text-[12px] text-zinc-300">
                <Link2 size={10} />{refImages.length}参考
              </span>
            )}
            {selectedSkill && (
              <span className="h-7 flex items-center px-3 rounded-full bg-sky-500/15 text-[12px] text-sky-300">
                /{selectedSkill}
              </span>
            )}
            {currentImage && (
              <button onClick={handleNineView} className="h-7 px-3 rounded-full bg-[#253040] text-[12px] text-zinc-300 hover:bg-sky-500/20 hover:text-sky-300 transition-all">
                九视图
              </button>
            )}
            </div>
            <div className="flex-1 min-w-[100px]" />
            <button onClick={handleSend} disabled={loading || !prompt.trim()}
              className="shrink-0 w-9 h-9 rounded-full bg-sky-500 hover:bg-sky-400 disabled:opacity-30 flex items-center justify-center text-white transition-all">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
