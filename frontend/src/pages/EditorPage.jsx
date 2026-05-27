import { useCallback, useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Image, Clapperboard, ZoomIn, ZoomOut, Maximize2, Sun, Moon } from 'lucide-react';

import GachaNode from '../nodes/GachaNode';
import VideoNode from '../nodes/VideoNode';
import LocalImageNode from '../nodes/LocalImageNode';
import BottomPanel from '../components/BottomPanel';
import { useThemeStore } from '../store/theme';
import { useCanvasStore } from '../store/canvas';
import { useProjectStore } from '../store/project';

const nodeTypes = { gachaNode: GachaNode, videoNode: VideoNode, localImageNode: LocalImageNode };

const NODE_CATALOG = [
  { type: 'gachaNode', label: '图像生成', icon: Image, color: 'text-sky-400' },
  { type: 'videoNode', label: '视频渲染', icon: Clapperboard, color: 'text-indigo-400' },
];

const defaultEdgeOptions = { animated: true, style: { stroke: 'rgba(168,85,247,0.4)', strokeWidth: 2 } };

function FlowCanvas() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const reactFlowWrapper = useRef(null);
  const idRef = useRef(0);
  const autoSaveTimer = useRef(null);
  const isLoadingProject = useRef(false);
  const { zoomIn, zoomOut, fitView, screenToFlowPosition } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { theme, toggleTheme } = useThemeStore();
  const { setModels, models } = useCanvasStore();
  const { currentProject, saveCanvas, saving, lastSaved, dirty, markDirty, openProject } = useProjectStore();

  const isDark = theme === 'dark';

  // 拉取模型列表
  useEffect(() => {
    fetch('/api/models').then(r => r.json()).then(d => setModels(d)).catch(() => {});
  }, [setModels]);

  // 根据 URL 中的 projectId 加载项目
  useEffect(() => {
    if (projectId) openProject(projectId);
  }, [projectId]);

  // Load canvas from project
  useEffect(() => {
    if (currentProject?.canvas_json) {
      isLoadingProject.current = true;
      const { nodes: pNodes, edges: pEdges } = currentProject.canvas_json;
      if (Array.isArray(pNodes)) {
        const fixedNodes = pNodes.map(n => {
          let styleRest = { ...n.style };
          if (styleRest.height) {
            delete styleRest.height;
          }
          if (n.type === 'localImageNode') {
            styleRest.width = 220;
          } else if (!styleRest.width) {
            styleRest.width = 280;
          }
          return { ...n, style: styleRest };
        });
        setNodes(fixedNodes);
      }
      if (Array.isArray(pEdges)) setEdges(pEdges);
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

  // ─── 监听侧栏图片导入事件 ───
  useEffect(() => {
    const handler = (e) => {
      const file = e.detail?.file;
      if (file) {
        const blobUrl = URL.createObjectURL(file);
        createNode('localImageNode', { x: 400, y: 300 }, { imageUrl: blobUrl, output: { image_url: blobUrl } });
      }
    };
    window.addEventListener('pupulin:import-image', handler);
    return () => window.removeEventListener('pupulin:import-image', handler);
  }, []);

  // ─── 数据流核心 ───
  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge(params, eds));
    setNodes((nds) => {
      const sourceNode = nds.find(n => n.id === params.source);
      const imageUrl = sourceNode?.data?.output?.image_url || sourceNode?.data?.imageUrl;
      const sourceOutput = sourceNode?.data?.output || (imageUrl ? { image_url: imageUrl } : null);
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
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  const createNode = useCallback((type, position, extraData = {}) => {
    idRef.current += 1;
    const initialData = { ...extraData };
    if (type === 'gachaNode' && !initialData.ratio) {
      initialData.ratio = currentProject?.ratio || '16:9';
    }
    const width = type === 'localImageNode' ? 220 : 280;
    const newNode = { id: `${type}-${Date.now()}-${idRef.current}`, type, position, data: initialData, style: { width } };
    setNodes((nds) => [...nds, newNode]);
    return newNode;
  }, [setNodes, currentProject?.ratio]);

  // ─── getUpstreamData: 获取上游节点数据 ───
  const getUpstreamData = useCallback((nodeId) => {
    const incomingEdges = edges.filter(e => e.target === nodeId);
    const result = {
      imageUrls: [],
      sceneIds: [],
    };
    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (sourceNode) {
        const imageUrl = sourceNode.data?.output?.image_url || sourceNode.data?.imageUrl;
        if (imageUrl) {
          result.imageUrls.push(imageUrl);
        }
        if (sourceNode.data?.output?.scene_id) {
          result.sceneIds.push(sourceNode.data.output.scene_id);
        }
      }
    }
    result.imageUrl = result.imageUrls[0] || null;
    result.sceneId = result.sceneIds[0] || null;
    result.faceUrl = result.imageUrl;
    return result;
  }, [edges, nodes]);

  // ─── 节点选中 → 弹出底部面板 ───
  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);

  const onUpdateNodeData = useCallback((nodeId, updates) => {
    setNodes((nds) => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n));
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

  // ─── 右键菜单 ───
  const onPaneContextMenu = useCallback((e) => {
    e.preventDefault();
    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    setContextMenu({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, flowPos: screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
  }, [screenToFlowPosition]);
  const onPaneClick = useCallback(() => { setContextMenu(null); setSelectedNode(null); }, []);

  // 注入回调到节点
  const projectIdStr = currentProject?.id || '';
  const nodesWithCallbacks = nodes.map(n => ({ ...n, data: { ...n.data, propagateData, deleteNode, projectId: projectIdStr } }));

  // 同步 selectedNode 的 data
  const syncedSelectedNode = selectedNode ? nodes.find(n => n.id === selectedNode.id) || selectedNode : null;

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
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
        onNodeClick={onNodeClick}
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

      {/* ─── 左下角控制台 ─── */}
      <div className={`absolute left-4 bottom-4 z-50 flex items-center gap-1 p-1.5 rounded-xl border backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${isDark ? 'bg-zinc-900/70 border-white/8' : 'bg-white/70 border-zinc-200'}`}>
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

      {/* ─── 底部操控面板 ─── */}
      {syncedSelectedNode && (
        <BottomPanel
          selectedNode={syncedSelectedNode}
          onUpdateNodeData={onUpdateNodeData}
          onClose={() => setSelectedNode(null)}
          getUpstreamData={getUpstreamData}
        />
      )}
    </div>
  );
}

export default function EditorPage() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
