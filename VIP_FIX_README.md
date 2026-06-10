# VIP 限制修复说明

## 🎯 问题分析

### 原始问题

你在 `server.py` 的 `CUSTOM_VIP_MODELS` 中添加了5个新视频模型:

1. `apimart/doubao-seedance-2.0`
2. `apimart/doubao-seedance-2.0-face`
3. `apimart/doubao-seedance-1-5-pro`
4. `apimart/kling-o1`
5. `agnes/agnes-video-v2.0`

**但它们没有被 VIP 限制**,原因是:

- ❌ 后端知道这些模型需要 VIP
- ❌ **前端不知道**,因为 `subscriptionGateManifest.json` 没有定义
- ❌ 结果: 前端不显示 VIP badge,不拦截,导致不一致

### 根本原因

AI Canvas 的 VIP 限制系统分为3层:

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: subscriptionGateManifest.json           │ ← 权威来源
│  - 定义哪些模型需要VIP                                │
│  - 后端Python和前端JS都读取这个文件                    │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Layer 2: 后端 server.py + subscription_gate_service│
│  - 读取manifest.json获取VIP模型列表                   │
│  - 验证CDKey和订阅状态                                │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Layer 3: 前端 subscriptionAccess.js               │
│  - 读取manifest.json获取VIP模型列表                   │
│  - 显示VIP badge和拦截弹窗                           │
└─────────────────────────────────────────────────────┘
```

**你只在 Layer 2 添加了模型,Layer 1 没有定义,所以 Layer 3 不生效!**

## ✅ 修复方案

### 修改内容

在 `apply_customizations.py` 中添加了新函数 `patch_subscription_gate_manifest_json()`:

**自动为你的5个新模型在 `subscriptionGateManifest.json` 中添加 gate 条目:**

1. **customApimartDoubaoVideo** - APImart 抖音 Seedance 系列
   - `apimart/doubao-seedance-2.0` (主模型)
   - `apimart/doubao-seedance-2.0-face` ✅ 你添加的
   - `apimart/doubao-seedance-1-5-pro` ✅ 你添加的
   - 使用 `modelPrefixes: ["apimart/doubao-seedance-"]` 覆盖整个系列

2. **customApimartKlingVideo** - APImart Kling 系列
   - `apimart/kling-o1` ✅ 你添加的
   - `apimart/kling-v3`, `apimart/kling-v3-omni`, `apimart/kling-v1-5`
   - 使用 `modelPrefixes: ["apimart/kling-"]` 覆盖整个系列

3. **customApimartOtherVideo** - APImart 其他视频模型
   - 覆盖 HappyHorse, Veo, Grok, Omni, Wan, Hailuo, Viduq 等

4. **customAgnesVideo** - Agnes 视频
   - `agnes/agnes-video-v2.0` ✅ 你添加的
   - 使用 `modelPrefixes: ["agnes/"]` 覆盖整个系列

5. **customVolcengineVideo** - 火山引擎 Seedance
   - `volcengine/seedance-2.0`, `volcengine/seedance-2.0-fast`

6. **customRunninghubModelVideo** - RunningHub modelApi 视频
   - 覆盖 `runninghub-model/*` 系列

### 为什么这样修复?

✅ **参考原作者的"商业级数字人"实现方式**:

```json
{
  "key": "runninghubCommercialDigitalHuman",
  "modelId": "runninghub/2055639633148563458",
  "workflowId": "2055639633148563458",
  "displayName": "商业级数字人",
  "aliases": [
    "commercial_digital_human",
    "commercial_digital_human.pro",
    "ai-app/2055639633148563458"
  ]
}
```

我们的方案:

- ✅ 在同一个 JSON 文件中定义
- ✅ 使用 `modelPrefixes` 一次性覆盖多个相似模型
- ✅ 前后端都能识别
- ✅ 符合原作者的架构设计

## 🚀 使用方法

### 1. 运行脚本

```bash
python3 apply_customizations.py
```

### 2. 重启服务

```bash
# Docker 方式
docker-compose down
docker-compose up -d

# 本地方式
# 停止正在运行的 server.py
# 重新运行
python3 server.py
```

### 3. 验证效果

打开前端,检查:

- ✅ 视频模型下拉菜单中显示 **VIP** badge
- ✅ 选择模型时弹出 VIP 验证弹窗
- ✅ 输入 CDKey 后可以正常使用

## 📝 技术细节

### subscriptionGateManifest.json 的作用

1. **后端读取** (`subscription_gate_manifest.py`):
   - `get_subscription_gate_model_ids()` - 获取所有VIP模型ID
   - `get_runninghub_subscription_workflow_ids()` - 获取RunningHub工作流ID
   - `normalize_subscription_gate_model_id()` - 规范化模型ID(支持别名和前缀匹配)

2. **前端读取** (`subscriptionAccess.js`):
   - `isVipModel()` - 判断模型是否需要VIP
   - `resolveVipGateModelId()` - 解析VIP gate模型ID
   - 显示VIP badge和触发验证弹窗

### modelPrefixes 的威力

使用前缀匹配可以一次性覆盖多个模型:

```json
{
  "modelPrefixes": ["apimart/doubao-seedance-"]
}
```

匹配:

- `apimart/doubao-seedance-2.0` ✅
- `apimart/doubao-seedance-2.0-fast` ✅
- `apimart/doubao-seedance-2.0-face` ✅
- `apimart/doubao-seedance-1-5-pro` ✅
- 未来的 `apimart/doubao-seedance-xxx` ✅

## 🔍 故障排除

### 前端仍然没有VIP标记?

1. **清除浏览器缓存**,或使用无痕模式
2. **检查 subscriptionGateManifest.json** 是否已更新:
   ```bash
   cat src/manifests/subscription/subscriptionGateManifest.json
   ```
3. **重启服务**

### 后端验证失败?

1. 检查 `.env` 文件中的 `AIC_SIGNING_SECRET`
2. 检查 `data/subscriptions.json` 是否正确保存CDKey
3. 查看服务器日志

### CDKey 生成问题?

使用 `key_generator.html`:

```bash
open key_generator.html
# 或访问 http://localhost:8777/key_generator.html
```

## 📚 相关文件

- `apply_customizations.py` - 主修复脚本 ⭐
- `src/manifests/subscription/subscriptionGateManifest.json` - VIP模型定义
- `backend/services/subscription_gate_manifest.py` - 后端读取逻辑
- `src/modules/subscriptionAccess.js` - 前端VIP检查逻辑
- `server.py` - CDKey验证和授权处理
- `key_generator.html` - CDKey生成工具

## 💡 未来添加新VIP模型

当你需要添加新的VIP模型时:

1. **在 `server.py` 的 `CUSTOM_VIP_MODELS` 中添加**
2. **在 `apply_customizations.py` 的 `patch_subscription_gate_manifest_json()` 中添加对应的gate条目**
3. **运行 `python3 apply_customizations.py`**
4. **重启服务**

就是这么简单! 🎉
