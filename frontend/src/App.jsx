import { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  useUpdateNodeInternals,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Terminal, Image, Clapperboard, ZoomIn, ZoomOut, Maximize2, Sun, Moon, FolderOpen, Save, Check } from 'lucide-react';

import ScriptNode from './nodes/ScriptNode';
import GachaNode from './nodes/GachaNode';
import VideoNode from './nodes/VideoNode';
import LocalImageNode from './nodes/LocalImageNode';
import PupuLinLogo from './components/PupuLinLogo';
import ProjectManager from './components/ProjectManager';
import { useThemeStore } from './store/theme';
import { useCanvasStore } from './store/canvas';
import { useProjectStore } from './store/project';

const nodeTypes = { scriptNode: ScriptNode, gachaNode: GachaNode, videoNode: VideoNode, localImageNode: LocalImageNode };

const NODE_CATALOG = [
  { type: 'scriptNode', label: '剧本中枢', icon: Terminal, color: 'text-purple-400' },
  { type: 'gachaNode', label: '图像生成', icon: Image, color: 'text-sky-400' },
  { type: 'videoNode', label: '视频渲染', icon: Clapperboard, color: 'text-indigo-400' },
];

const defaultEdgeOptions = { animated: true, style: { stroke: 'rgba(168,85,247,0.4)', strokeWidth: 2 } };

function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const reactFlowWrapper = useRef(null);
  const idRef = useRef(0);
  const autoSaveTimer = useRef(null);
  const isLoadingProject = useRef(false);
  const { zoomIn, zoomOut, fitView, screenToFlowPosition } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { theme, toggleTheme } = useThemeStore();
  const { setModels } = useCanvasStore();
  const { currentProject, saveCanvas, saving, lastSaved, dirty, markDirty, openProject } = useProjectStore();

  const isDark = theme === 'dark';

  // 拉取模型列表
  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(d => setModels(d)).catch(() => {});
  }, [setModels]);

  // Load canvas from project
  useEffect(() => {
    if (currentProject?.canvas_json) {
      isLoadingProject.current = true;
      const { nodes: pNodes, edges: pEdges } = currentProject.canvas_json;
      if (Array.isArray(pNodes)) {
        // 加载时移除固定 height，让内容自适应高度，避免 Handle 错位
        const fixedNodes = pNodes.map(n => {
          if (n.style?.height) {
            const { height, ...rest } = n.style;
            return { ...n, style: rest };
          }
          return n;
        });
        setNodes(fixedNodes);
      }
      if (Array.isArray(pEdges)) setEdges(pEdges);
      // 加载后强制更新所有节点内部尺寸 + fitView，修复 Handle 错位
      setTimeout(() => {
        if (Array.isArray(pNodes)) {
          pNodes.forEach(n => updateNodeInternals(n.id));
        }
        fitView({ duration: 200, padding: 0.3 });
      }, 150);
    }
  }, [currentProject?.id]);

  // Auto-save every 5 seconds
  useEffect(() => {
    if (!currentProject) return;
    if (isLoadingProject.current) { isLoadingProject.current = false; return; }
    markDirty();
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const cleanNodes = nodes.map(n => {
        const { height, ...styleRest } = n.style || {};
        return { ...n, style: styleRest, data: { ...n.data, propagateData: undefined, deleteNode: undefined } };
      });
      saveCanvas(cleanNodes, edges);
    }, 5000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [nodes, edges]);

  const handleOpenProject = useCallback((project) => {
    openProject(project.id);
    setShowProjectManager(false);
  }, [openProject]);

  const handleManualSave = useCallback(() => {
    if (!currentProject) return;
    const cleanNodes = nodes.map(n => {
      const { height, ...styleRest } = n.style || {};
      return { ...n, style: styleRest, data: { ...n.data, propagateData: undefined, deleteNode: undefined } };
    });
    saveCanvas(cleanNodes, edges);
  }, [currentProject, nodes, edges, saveCanvas]);

  // ─── 数据流核心 ───
  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge(params, eds));
    // 连线时立即推送上游 output 到下游
    setNodes((nds) => {
      const sourceNode = nds.find(n => n.id === params.source);
      const sourceOutput = sourceNode?.data?.output;
      if (!sourceOutput) return nds;
      return nds.map(n => n.id === params.target ? { ...n, data: { ...n.data, inputData: sourceOutput } } : n);
    });
  }, [setEdges, setNodes]);

  const propagateData = useCallback((sourceId, output) => {
    setNodes((nds) => nds.map(n => n.id === sourceId ? { ...n, data: { ...n.data, output } } : n));
    setEdges((currentEdges) => {
      const downstream = currentEdges.filter(e => e.source === sourceId);
      if (downstream.length > 0) {
        setNodes((nds) => nds.map(n => downstream.some(e => e.target === n.id) ? { ...n, data: { ...n.data, inputData: output } } : n));
      }
      return currentEdges;
    });
  }, [setNodes, setEdges]);

  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter(n => n.id !== nodeId));
    setEdges((eds) => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  const createNode = useCallback((type, position, extraData = {}) => {
    idRef.current += 1;
    const defaultWidth = type === 'scriptNode' ? 300 : 280;
    const newNode = { id: `${type}-${Date.now()}-${idRef.current}`, type, position, data: extraData, style: { width: defaultWidth } };
    setNodes((nds) => [...nds, newNode]);
    return newNode;
  }, [setNodes]);

  // ─── DnD ───
  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/reactflow');
    if (!type && e.dataTransfer.files?.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const blobUrl = URL.createObjectURL(file);
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        createNode('localImageNode', position, { imageUrl: blobUrl, output: { image_url: blobUrl } });
        return;
      }
    }
    if (!type) return;
    createNode(type, screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [screenToFlowPosition, createNode]);

  const onDragStart = (e, nodeType) => { e.dataTransfer.setData('application/reactflow', nodeType); e.dataTransfer.effectAllowed = 'move'; };

  // ─── 右键菜单 ───
  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    setContextMenu({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, flowPos: screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
  }, [screenToFlowPosition]);
  const onPaneClick = useCallback(() => { setContextMenu(null); }, []);

  // 注入回调到节点
  const projectId = currentProject?.id || '';
  const nodesWithCallbacks = nodes.map(n => ({ ...n, data: { ...n.data, propagateData, deleteNode, projectId } }));

  return (
    <div ref={reactFlowWrapper} className={`w-screen h-screen relative overflow-hidden ${isDark ? 'bg-[#0a0a0f]' : 'bg-zinc-50'}`}>
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={['Backspace', 'Delete']}
        edgesFocusable={true}
        edgesUpdatable={true}
        zoomOnScroll={false}
        panOnScroll={false}
        panOnDrag={[1]}
        panActivationKeyCode="Space"
        selectionOnDrag={true}
        selectionMode="partial"
        multiSelectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant="dots" gap={28} size={1} color={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'} />
      </ReactFlow>

      {/* ─── 品牌栏 ─── */}
      <div className={`fixed top-4 left-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] ${isDark ? 'bg-zinc-900/70 border-white/8' : 'bg-white/70 border-zinc-200'}`}>
        <PupuLinLogo size={22} />
        <div className={`w-px h-5 ${isDark ? 'bg-white/8' : 'bg-zinc-300'}`} />
        <button onClick={() => setShowProjectManager(true)}
          className={`flex items-center gap-1.5 text-xs transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'}`}>
          <FolderOpen size={13} />
          <span className="max-w-[140px] truncate">{currentProject ? currentProject.name : '打开文稿'}</span>
        </button>
        {currentProject && (
          <>
            <button onClick={handleManualSave}
              className={`p-1 rounded-md transition-colors ${saving ? 'animate-pulse' : ''} ${isDark ? 'text-zinc-500 hover:text-zinc-200' : 'text-zinc-400 hover:text-zinc-700'}`}
              title="保存">
              {saving ? <Save size={13} className="text-amber-400" /> : (!dirty && lastSaved) ? <Check size={13} className="text-emerald-400" /> : <Save size={13} />}
            </button>
            {lastSaved && !dirty && (
              <span className={`text-[9px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {lastSaved.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            )}
          </>
        )}
      </div>

      {/* ─── 左侧组件库 ─── */}
      <div className={`fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1 p-3 rounded-2xl border backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.6)] ${isDark ? 'bg-zinc-900/70 border-white/8' : 'bg-white/70 border-zinc-200'}`}>
        <p className={`text-[9px] uppercase tracking-widest text-center mb-2 font-semibold ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>组件</p>
        {NODE_CATALOG.map(({ type, label, icon: Icon, color }) => (
          <div key={type} draggable onDragStart={(e) => onDragStart(e, type)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all select-none border border-transparent hover:border-white/10 ${isDark ? 'bg-zinc-800/40 hover:bg-zinc-800/80' : 'bg-zinc-100 hover:bg-zinc-200'}`}>
            <Icon size={14} className={color} />
            <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>{label}</span>
          </div>
        ))}
        <div className={`w-full h-px my-1 ${isDark ? 'bg-white/5' : 'bg-zinc-200'}`} />
        <label className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent hover:border-white/10 ${isDark ? 'bg-zinc-800/40 hover:bg-emerald-900/30' : 'bg-zinc-100 hover:bg-emerald-50'}`}>
          <Image size={14} className="text-emerald-400" />
          <span className={`text-[11px] font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>导入图片</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const blobUrl = URL.createObjectURL(file);
              createNode('localImageNode', { x: 400, y: 300 }, { imageUrl: blobUrl, output: { image_url: blobUrl } });
            }
            e.target.value = '';
          }} />
        </label>
      </div>

      {/* ─── 左下角控制台 ─── */}
      <div className={`fixed left-4 bottom-4 z-50 flex items-center gap-1 p-1.5 rounded-xl border backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${isDark ? 'bg-zinc-900/70 border-white/8' : 'bg-white/70 border-zinc-200'}`}>
        <button onClick={() => zoomIn()} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isDark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'}`}><ZoomIn size={14} /></button>
        <button onClick={() => zoomOut()} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isDark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'}`}><ZoomOut size={14} /></button>
        <button onClick={() => fitView({ duration: 400 })} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isDark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60' : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'}`}><Maximize2 size={14} /></button>
        <div className={`w-px h-4 mx-0.5 ${isDark ? 'bg-white/8' : 'bg-zinc-300'}`} />
        <button onClick={toggleTheme} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isDark ? 'text-zinc-500 hover:text-amber-400 hover:bg-zinc-800/60' : 'text-zinc-400 hover:text-indigo-500 hover:bg-zinc-100'}`}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* ─── 右键菜单 ─── */}
      {contextMenu && (
        <div className={`absolute z-[100] py-2 min-w-[180px] rounded-xl border backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7)] ${isDark ? 'bg-zinc-900/80 border-white/10' : 'bg-white/90 border-zinc-200'}`} style={{ left: contextMenu.x, top: contextMenu.y }}>
          <p className={`px-3 py-1 text-[9px] uppercase tracking-widest font-semibold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>添加节点</p>
          {NODE_CATALOG.map(({ type, label, icon: Icon, color }) => (
            <button key={type} onClick={() => { createNode(type, contextMenu.flowPos); setContextMenu(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100'}`}>
              <Icon size={13} className={color} />
              <span className={`text-xs ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 文稿管理弹窗 */}
      <ProjectManager open={showProjectManager} onClose={() => setShowProjectManager(false)} onOpenProject={handleOpenProject} />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
