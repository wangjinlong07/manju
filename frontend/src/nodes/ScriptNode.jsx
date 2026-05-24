import { useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position, useReactFlow, useStore } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';
import { Terminal, Send, Sparkles, ImagePlus, Link2 } from 'lucide-react';

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

export default function ScriptNode({ id, data, selected }) {
  const scenes = data.output || [];
  const [theme, setTheme] = useState(data.prompt || '');
  const [provider, setProvider] = useState(data.provider || 'deepseek-v4-flash');
  const [thinking, setThinking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [skills, setSkills] = useState([]);
  const [selectedScenes, setSelectedScenes] = useState(new Set());
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(data.skill || '');
  const { setNodes, setEdges, getNode } = useReactFlow();
  const edges = useStore(s => s.edges);
  const [faceNodeId, setFaceNodeId] = useState(null);
  const [faceUrl, setFaceUrl] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/models`).then(r => r.json()).then(d => {
      setModels(d.llm || []);
      setSkills(d.skills?.script || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const incoming = edges.filter(e => e.target === id);
    for (const edge of incoming) {
      const src = getNode(edge.source);
      if (src?.type === 'localImageNode' && src.data?.output?.image_url) { setFaceNodeId(src.id); setFaceUrl(src.data.output.image_url); return; }
    }
    setFaceNodeId(null); setFaceUrl('');
  }, [edges, id, getNode]);

  const handleTextChange = useCallback((e) => {
    const val = e.target.value;
    const lastChar = val[e.target.selectionStart - 1];
    setTheme(val);
    if (lastChar === '/') setShowSkillPicker(true);
    else setShowSkillPicker(false);
  }, []);

  const insertSkill = useCallback((skill) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = theme.slice(0, pos - 1);
    const after = theme.slice(pos);
    const insert = `/${skill.id} `;
    setTheme(before + insert + after);
    setSelectedSkill(skill.id);
    setShowSkillPicker(false);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = before.length + insert.length; }, 0);
  }, [theme]);

  const handleSend = useCallback(async () => {
    if (!theme.trim()) return;
    setLoading(true);
    const payload = { theme, llm_provider: provider, thinking, skill: selectedSkill };
    console.log('[ScriptNode] API 调用参数:', JSON.stringify(payload, null, 2));
    try {
      const res = await fetch(`${API_BASE}/script/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const s = result.scenes || [];
      console.log('[ScriptNode] 生成分镜数:', s.length);
      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, output: s, prompt: theme, provider, skill: selectedSkill } } : n));
      data.propagateData?.(id, s);
      setSelectedScenes(new Set());
    } catch (e) { console.error('[ScriptNode] 错误:', e); } finally { setLoading(false); }
  }, [theme, provider, thinking, id, setNodes, data, selectedSkill]);

  const expandSelected = useCallback(() => {
    const indices = [...selectedScenes].sort((a, b) => a - b);
    if (!indices.length) return;
    const cur = getNode(id);
    const baseX = (cur?.position?.x || 0) + 400;
    const baseY = (cur?.position?.y || 0);
    let c = 0;
    const newNodes = [], newEdges = [];
    for (const i of indices) {
      c++;
      const scene = scenes[i];
      const nodeId = `gachaNode-${Date.now()}-${c}`;
      newNodes.push({ id: nodeId, type: 'gachaNode', position: { x: baseX, y: baseY + (c-1) * 350 }, data: { prompt: sceneToText(scene), inputData: { scene } } });
      newEdges.push({ id: `e-${id}-${nodeId}`, source: id, target: nodeId, animated: true, style: { stroke: 'rgba(168,85,247,0.5)', strokeWidth: 2 } });
      if (faceNodeId) newEdges.push({ id: `e-f-${faceNodeId}-${nodeId}`, source: faceNodeId, target: nodeId, animated: true, style: { stroke: 'rgba(16,185,129,0.4)', strokeWidth: 1.5 } });
    }
    setNodes(nds => [...nds, ...newNodes]);
    setEdges(eds => [...eds, ...newEdges]);
    setSelectedScenes(new Set());
  }, [selectedScenes, scenes, id, setNodes, setEdges, getNode, faceNodeId]);

  return (
    <div className="relative w-full h-fit" style={{ overflow: 'visible', minWidth: 300 }}>
      {selected && <NodeResizer minWidth={180} minHeight={100} isVisible={true} keepAspectRatio={true} lineClassName="!border-purple-500/50" handleClassName="!w-2 !h-2 !bg-purple-500 !border-none" />}
      {/* ─── Scene List Card ─── */}
      <div className={`relative w-full rounded-2xl bg-[#1e1e2e] border border-[#2d2d44] overflow-hidden transition-shadow ${selected ? 'shadow-[0_0_30px_rgba(168,85,247,0.25)]' : 'shadow-xl'}`}>
        {loading && (
          <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center rounded-2xl">
            <div className="w-8 h-8 border-3 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        )}
        <div className="p-3 min-h-[60px]">
          {scenes.length > 0 ? (
            <div className="space-y-1 max-h-[200px] overflow-y-auto nowheel" onWheel={e => e.stopPropagation()}>
              {scenes.map((s, i) => (
                <div key={i} onClick={() => { const n = new Set(selectedScenes); n.has(i) ? n.delete(i) : n.add(i); setSelectedScenes(n); }}
                  className={`px-2 py-1.5 rounded-xl text-[11px] cursor-pointer transition-all nodrag ${selectedScenes.has(i) ? 'bg-purple-500/15 text-zinc-200' : 'text-zinc-400 hover:bg-zinc-800/40'}`}>
                  <span className="text-purple-400 font-bold">#{i+1}</span> {s.scene_description || s.image_prompt_cn || ''}
                </div>
              ))}
              {selectedScenes.size > 0 && (
                <button onClick={expandSelected} className="w-full mt-1.5 py-2 rounded-xl bg-purple-500/15 text-[11px] text-purple-300 font-medium flex items-center justify-center gap-1.5 nodrag hover:bg-purple-500/25 transition-colors">
                  <ImagePlus size={11} />展开 {selectedScenes.size} 镜
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[50px]">
              <Terminal size={24} className="text-zinc-800" />
            </div>
          )}
        </div>
      </div>
      {/* Handles outside overflow-hidden card */}
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-sky-500 !border-2 !border-[#1e1e2e]" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-purple-500 !border-2 !border-[#1e1e2e]" />

      {/* ─── Input Bar (absolute, below node) ─── */}
      {selected && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-fit rounded-2xl bg-[#1c2333] border border-[#2a3a50] shadow-2xl nowheel nodrag"
          onWheel={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Row 1: Reference image if connected */}
          {faceUrl && (
            <div className="flex items-center gap-2 px-4 pt-3">
              <img src={faceUrl} alt="" className="w-11 h-11 rounded-xl object-cover border border-zinc-700" />
            </div>
          )}
          {/* Row 2: Textarea with / trigger */}
          <div className="px-4 pt-3 pb-2 relative">
            <textarea ref={textareaRef} value={theme} onChange={handleTextChange}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              className="w-full bg-transparent text-[13px] text-zinc-200 outline-none resize-none min-h-[110px] max-h-[110px] overflow-y-auto leading-relaxed placeholder-zinc-600"
              placeholder="输入漫剧主题... 输入 / 唤起风格"
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'; }} />
            {/* Skill picker popup */}
            {showSkillPicker && skills.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 max-h-40 overflow-y-auto rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl z-60">
                {skills.map(s => (
                  <button key={s.id} onClick={() => insertSkill(s)}
                    className="w-full text-left px-3 py-2 text-[12px] text-zinc-300 hover:bg-purple-500/15 hover:text-purple-300 transition-colors">
                    /{s.id} <span className="text-zinc-500 ml-1">{s.display_name}</span>
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
            <button onClick={() => setThinking(!thinking)}
              className={`h-7 px-3 rounded-full text-[12px] flex items-center gap-1 transition-all ${thinking ? 'bg-amber-500/20 text-amber-300' : 'bg-[#253040] text-zinc-300'}`}>
              <Sparkles size={10} />深度思考
            </button>
            {selectedSkill && (
              <span className="h-7 flex items-center px-3 rounded-full bg-purple-500/15 text-[12px] text-purple-300">
                /{selectedSkill}
              </span>
            )}
            </div>
            <div className="flex-1 min-w-[100px]" />
            <button onClick={handleSend} disabled={loading || !theme.trim()}
              className="shrink-0 w-9 h-9 rounded-full bg-purple-500 hover:bg-purple-400 disabled:opacity-30 flex items-center justify-center text-white transition-all">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
