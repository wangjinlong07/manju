#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AICanvas 定制化修改一键应用与升级助手 (apply_customizations.py)
------------------------------------------------------------
当原作者更新代码后，您只需直接拉取原作者最新分支代码（或覆盖文件），
然后运行本脚本：python apply_customizations.py 即可自动重新注入所有的 VIP 校验、自托管微信、子路径支持。
无需再手动解决合并冲突！
"""

import os
import re
import shutil
import json

# 定义要修改的文件路径
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
SERVER_PY = os.path.join(DIRECTORY, "server.py")
STYLE_CSS = os.path.join(DIRECTORY, "style.css")
API_URL_JS = os.path.join(DIRECTORY, "api", "apiUrl.js")
GATE_SERVICE_PY = os.path.join(DIRECTORY, "backend", "services", "subscription_gate_service.py")
SUBSCRIPTION_ACCESS_JS = os.path.join(DIRECTORY, "src", "modules", "subscriptionAccess.js")
VENDOR_VIDEO_MANIFESTS_JS = os.path.join(DIRECTORY, "src", "manifests", "video", "modelApi", "vendorVideoModelApiManifests.js")
DREAMINA_VIDEO_MANIFEST_JS = os.path.join(DIRECTORY, "src", "manifests", "video", "dreamina", "dreaminaVideoManifest.js")
RUNNINGHUB_VIDEO_MANIFEST_JS = os.path.join(DIRECTORY, "src", "manifests", "shared", "runningHubVideoManifestShared.js")
PARAMETER_PANEL_MODULE_JS = os.path.join(DIRECTORY, "src", "components", "video-node", "parameterPanelModule.js")

def make_backup(filepath):
    if os.path.exists(filepath):
        backup_path = filepath + ".bak"
        shutil.copy2(filepath, backup_path)
        print(f"✅ 已备份 {os.path.basename(filepath)} -> {os.path.basename(backup_path)}")

def patch_server_py():
    print("🔧 正在处理 server.py...")
    if not os.path.exists(SERVER_PY):
        print("❌ 未找到 server.py")
        return False
        
    make_backup(SERVER_PY)
    
    with open(SERVER_PY, "r", encoding="utf-8") as f:
        content = f.read()
        
    # 0. 注入本地运行的 .env 加载器，以便在本地直接启动时加载环境配置和签名秘钥
    if "def _load_env_file():" not in content:
        env_loader_block = """
# ════════════════════════════════════════════════════════════════
#  Load .env file manually for local runs (avoiding dependency on python-dotenv)
# ════════════════════════════════════════════════════════════════
def _load_env_file():
    import os
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        key, val = parts[0].strip(), parts[1].strip()
                        if key not in os.environ:
                            os.environ[key] = val
        except Exception as e:
            print(f"[env_loader] Warning: failed to load .env: {e}")
_load_env_file()
"""
        content = content.replace("import sys", "import sys" + env_loader_block)
        print("  - 已注入本地 .env 配置文件加载器")

    # 1. 修改默认微信联系方式
    content = content.replace('"yumengashuo"', '"vv2643162286"') # Match .env wechat config
    content = content.replace('"https://api.ashuoai.com/static/contact/wechat.png"', '"/images/wechat.png"')
    
    # 2. 注入中央授权处理函数（幂等：先移除旧块再注入新块）
    if "_handle_central_subscription_status" in content:
        content = re.sub(
            r'\n# ═{4,}\n#  Central subscription licensing handlers[^\n]*\n# ═{4,}\n.*?(?=\nclass Handler\()',
            '\n',
            content,
            flags=re.DOTALL
        )
        print("  - 已移除旧的中央授权处理函数块，准备重新注入")

    licensing_block = """
# ════════════════════════════════════════════════════════════════
#  Central subscription licensing handlers (HMAC-SHA256 Based)
# ════════════════════════════════════════════════════════════════
_SUBSCRIPTION_DB_LOCK = threading.Lock()
SUBSCRIPTION_DB_FILE = os.path.join("data", "subscriptions.json")

CUSTOM_VIP_MODELS = [
    "apimart/doubao-seedance-2.0",
    "apimart/doubao-seedance-2.0-face",
    "apimart/doubao-seedance-1-5-pro",
    "apimart/kling-o1",
    "agnes/agnes-video-v2.0",
    "apimart/doubao-seedance-2.0-fast",
    "apimart/doubao-seedance-2.0-fast-face",
    "apimart/doubao-seedance-1-0-pro-quality",
    "apimart/doubao-seedance-1-0-pro-fast",
    "apimart/happyhorse-1.0",
    "apimart/veo3-fast",
    "apimart/grok-imagine-1.0",
    "apimart/omni-flash-ext",
    "apimart/wan2.7",
    "apimart/kling-v3-omni",
    "apimart/kling-v3",
    "apimart/minimax-hailuo",
    "apimart/minimax-hailuo-2.3",
    "apimart/kling-v1-5",
    "apimart/viduq3",
    "volcengine/seedance-2.0",
    "volcengine/seedance-2.0-fast",
    "runninghub-model/seedance-2.0",
    "runninghub-model/happyhorse-1.0",
    "runninghub-model/veo3",
    "runninghub-model/wan2.7",
    "runninghub-model/hailuo-02",
    "runninghub-model/hailuo-2.3",
    "runninghub-model/kling-v3",
    "runninghub-model/kling-o3",
    "runninghub-model/kling-video-o1",
]

def _get_all_entitled_model_ids():
    base = list(VIDEO_VIP_MODEL_NAME_MAP.keys())
    for m in CUSTOM_VIP_MODELS:
        if m not in base:
            base.append(m)
    return base

def _load_subscriptions():
    with _SUBSCRIPTION_DB_LOCK:
        if not os.path.exists(SUBSCRIPTION_DB_FILE):
            return {}
        try:
            with open(SUBSCRIPTION_DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

def _save_subscriptions(data):
    with _SUBSCRIPTION_DB_LOCK:
        os.makedirs(os.path.dirname(SUBSCRIPTION_DB_FILE), exist_ok=True)
        tmp = SUBSCRIPTION_DB_FILE + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(tmp, SUBSCRIPTION_DB_FILE)
            return True
        except Exception as e:
            print(f"[subscription_server] failed to save subscription: {e}")
            if os.path.exists(tmp):
                try: os.remove(tmp)
                except Exception: pass
            return False

def _handle_central_subscription_status(handler):
    import urllib.parse
    import time
    parsed = urllib.parse.urlsplit(handler.path)
    qs = urllib.parse.parse_qs(parsed.query)
    install_id = (qs.get("installId") or [""])[0].strip()
    if not install_id:
        _json_ok(handler, {"success": False, "message": "Missing installId"})
        return
    
    subs = _load_subscriptions()
    sub = subs.get(install_id)
    
    if sub:
        expires_at = sub.get("expiresAt", 0)
        if expires_at > int(time.time()):
            _json_ok(handler, {
                "success": True,
                "data": {
                    "status": "active",
                    "expiresAt": expires_at,
                    "entitledModelIds": _get_all_entitled_model_ids()
                }
            })
            return
            
    _json_ok(handler, {
        "success": True,
        "data": {
            "status": "none",
            "expiresAt": 0,
            "entitledModelIds": _get_all_entitled_model_ids()
        }
    })

def _handle_central_subscription_activate(handler):
    import base64
    import hmac
    import hashlib
    import time
    
    content_length = int(handler.headers.get("Content-Length", 0))
    body = handler.rfile.read(content_length)
    try:
        data = json.loads(body)
    except Exception:
        _json_ok(handler, {"success": False, "message": "Invalid JSON"})
        return
        
    install_id = str(data.get("installId") or "").strip()
    cdkey = str(data.get("cdkey") or "").strip()
    device_id = str(data.get("deviceId") or "").strip() or install_id
    
    if not install_id or not cdkey:
        _json_ok(handler, {"success": False, "message": "Missing installId or cdkey"})
        return
        
    secret = os.environ.get("AIC_SIGNING_SECRET", "").strip()
    if not secret:
        _json_ok(handler, {"success": False, "message": "服务器未启用授权秘钥配置，请联系管理员"})
        return
        
    try:
        missing_padding = len(cdkey) % 4
        padded_cdkey = cdkey
        if missing_padding:
            padded_cdkey += '=' * (4 - missing_padding)
        decoded = base64.b64decode(padded_cdkey).decode("utf-8", errors="ignore")
        parts = decoded.split(":")
        if len(parts) != 3:
            _json_ok(handler, {"success": False, "message": "激活码格式不正确"})
            return
            
        key_install_id, key_expires_at_str, signature = parts
        
        if key_install_id != install_id:
            _json_ok(handler, {"success": False, "message": "激活码与当前设备ID不匹配"})
            return
            
        try:
            expires_at = int(key_expires_at_str)
        except ValueError:
            _json_ok(handler, {"success": False, "message": "激活码时间格式错误"})
            return
            
        if expires_at <= int(time.time()):
            _json_ok(handler, {"success": False, "message": "该激活码已过期"})
            return
            
        message = f"{key_install_id}:{key_expires_at_str}"
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_sig, signature):
            _json_ok(handler, {"success": False, "message": "激活码验证失败（签名不匹配）"})
            return
            
        subs = _load_subscriptions()
        subs[install_id] = {
            "expiresAt": expires_at,
            "activatedAt": int(time.time()),
            "cdkey": cdkey,
            "deviceId": device_id
        }
        if _save_subscriptions(subs):
            _json_ok(handler, {
                "success": True,
                "data": {
                    "status": "active",
                    "expiresAt": expires_at,
                    "entitledModelIds": _get_all_entitled_model_ids()
                }
            })
        else:
            _json_ok(handler, {"success": False, "message": "服务器保存激活状态失败"})
            
    except Exception as e:
        _json_ok(handler, {"success": False, "message": f"解析激活码失败: {str(e)}"})


"""
    content = content.replace("class Handler(http.server.SimpleHTTPRequestHandler):", licensing_block + "class Handler(http.server.SimpleHTTPRequestHandler):")
    print("  - 已注入卡密数据库及签名处理函数（含自定义VIP模型）")

    # 3. 注入子路径剥离 /manju/
    if 'self.path.startswith("/manju/")' not in content:
        subpath_strip = """        res = super().parse_request()
        if res:
            if self.path.startswith("/manju/"):
                self.path = self.path[6:]
            elif self.path == "/manju":
                self.path = "/"
"""
        content = content.replace("        res = super().parse_request()", subpath_strip)
        print("  - 已注入 server-side 子路径 /manju 剥离逻辑")

    # 4. 注入 do_GET 状态拦截 (支持带 /api/v2/ 前缀的真实路由)
    if 'path in ("/api/v2/subscription/status", "/api/subscription/status")' not in content:
        # 清除旧的注入路由（如果存在）
        content = content.replace('path == "/api/subscription/status"', 'path in ("/api/v2/subscription/status", "/api/subscription/status")')
        
        # 新增注入逻辑
        get_status_block = """    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/api/v2/subscription/status", "/api/subscription/status"):
            _handle_central_subscription_status(self)
            return
"""
        if 'path in ("/api/v2/subscription/status", "/api/subscription/status")' not in content:
            content = content.replace("    def do_GET(self):\n        path = self.path.split(\"?\")[0]", get_status_block)
        print("  - 已注入 GET /api/v2/subscription/status 路由")

    # 5. 注入 do_POST 激活拦截 (支持带 /api/v2/ 前缀的真实路由)
    if 'path in ("/api/v2/subscription/activate", "/api/subscription/activate")' not in content:
        # 清除旧的注入路由（如果存在）
        content = content.replace('path == "/api/subscription/activate"', 'path in ("/api/v2/subscription/activate", "/api/subscription/activate")')
        
        # 新增注入逻辑
        post_activate_block = """    def do_POST(self):
        path = self.path.split("?")[0]
        if path in ("/api/v2/subscription/activate", "/api/subscription/activate"):
            _handle_central_subscription_activate(self)
            return
"""
        if 'path in ("/api/v2/subscription/activate", "/api/subscription/activate")' not in content:
            content = content.replace("    def do_POST(self):\n        path = self.path.split(\"?\")[0]", post_activate_block)
        print("  - 已注入 POST /api/v2/subscription/activate 路由")

    print("  - 已修正路由为仅拦截内部路径（/api/v2/ 走调度器获取联系方式）")

    with open(SERVER_PY, "w", encoding="utf-8") as f:
        f.write(content)
    print("🎉 server.py 修改完成！")
    return True

def patch_gate_service_py():
    print("🔧 正在处理 subscription_gate_service.py...")
    if not os.path.exists(GATE_SERVICE_PY):
        print("❌ 未找到 subscription_gate_service.py")
        return False
        
    make_backup(GATE_SERVICE_PY)
    
    with open(GATE_SERVICE_PY, "r", encoding="utf-8") as f:
        content = f.read()

    # 原作者绕过 VIP 校验的代码特征
    bypassed_code_block = """    def check_vip_subscription_gate(self, handler, payload=None, required_model_id=""):
        # Bypassed: always allow VIP model access (using our own API keys)
        install_id = self.extract_install_id_from_request(handler, payload)
        device_id = self._extract_device_id_from_request(
            handler,
            payload,
            fallback_install_id=install_id,
        )
        model_id = self.normalize_vip_model_id(required_model_id)
        return {
            "allowed": True,
            "installId": install_id or "",
            "deviceId": device_id or "",
            "status": self.status_active,
            "reasonCode": "ACTIVE",
            "reasonMessage": "",
            "requiredModelId": model_id,
            "payload": {
                "status": self.status_active,
                "entitledModelIds": list(self.model_name_map.keys()) if self.model_name_map else [],
            },
        }"""

    restored_code_block = """    def check_vip_subscription_gate(self, handler, payload=None, required_model_id=""):
        install_id = self.extract_install_id_from_request(handler, payload)
        device_id = self._extract_device_id_from_request(
            handler,
            payload,
            fallback_install_id=install_id,
        )
        model_id = self.normalize_vip_model_id(required_model_id)
        cached_decision = self._get_cached_vip_allow_decision(install_id, model_id, device_id)
        if isinstance(cached_decision, dict):
            return cached_decision

        try:
            decision = self.client.evaluate_install_active(install_id, device_id=device_id)
        except TypeError:
            decision = self.client.evaluate_install_active(install_id)
        decision = dict(decision) if isinstance(decision, dict) else {}
        decision["requiredModelId"] = model_id
        if device_id:
            decision["deviceId"] = device_id
        if bool(decision.get("allowed")) and model_id:
            entitled_ids = self.extract_entitled_model_ids(decision.get("payload"))
            entitled = (
                model_id in entitled_ids
                if entitled_ids
                else self._is_install_entitled_for_model(install_id, model_id, device_id)
            )
            if not entitled:
                decision["allowed"] = False
                decision["reasonCode"] = self.error_model_not_entitled
                model_name = self.model_name_map.get(model_id) or model_id
                decision["reasonMessage"] = f"当前订阅未包含 {model_name}"
                self.clear_vip_allow_cache(install_id, device_id)
            else:
                if not entitled_ids:
                    entitled_ids = [model_id]
                self._cache_vip_allow_decision(
                    install_id,
                    payload=decision.get("payload"),
                    entitled_ids=entitled_ids,
                    device_id=device_id,
                )
        elif install_id:
            self.clear_vip_allow_cache(install_id, device_id)
        self._log_first_vip_gate_success(decision)
        return decision"""

    if bypassed_code_block in content:
        content = content.replace(bypassed_code_block, restored_code_block)
        print("  - 已移除了原作者的 VIP 限制旁路，重新启用了真实验证门槛")
    elif "check_vip_subscription_gate" in content and "client.evaluate_install_active" not in content:
        # 兜底正则替换以防细微格式不一致
        content = re.sub(
            r"def check_vip_subscription_gate\(self, handler, payload=None, required_model_id=\"\"\):.*?return \{.*?\}",
            restored_code_block,
            content,
            flags=re.DOTALL
        )
        print("  - 兜底校验：重新激活拦截")
    else:
        print("  - VIP 拦截校验已处于激活状态，无需处理")

    with open(GATE_SERVICE_PY, "w", encoding="utf-8") as f:
        f.write(content)
    print("🎉 subscription_gate_service.py 修改完成！")
    return True

def patch_style_css():
    print("🔧 正在处理 style.css...")
    if not os.path.exists(STYLE_CSS):
        print("❌ 未找到 style.css")
        return False
        
    make_backup(STYLE_CSS)
    
    with open(STYLE_CSS, "r", encoding="utf-8") as f:
        content = f.read()
        
    # 移除可能存在的隐藏订阅相关的 CSS 样式
    # 包含注释形式或 minified 形式
    hiding_css = """/* ── Hide subscription center (bypassed) ── */
[data-pane="subscription"],
#pane-subscription,
.subscription-gate-overlay { display: none !important; }"""

    # 正则表达式匹配 minified 形式的隐藏样式
    minified_pattern = r'\[data-pane="subscription"\],\s*#pane-subscription,\s*\.subscription-gate-overlay\s*\{\s*display:\s*none\s*!important;?\s*\}'

    if hiding_css in content:
        content = content.replace(hiding_css, "")
        print("  - 已移除 style.css 底部注释形式的隐藏 VIP 弹窗与订阅中心的布局限制")
    else:
        content, count = re.subn(minified_pattern, "", content)
        if count > 0:
            print(f"  - 已通过正则移除 {count} 处隐藏 VIP 弹窗与订阅中心的布局限制")
        else:
            print("  - 未检测到 style.css 隐藏 VIP 样式的布局限制，无需修改")

    custom_vip_layout = """
/* ── VIP Dialog WeChat Layout Fix ── */
.subscription-gate-dialog .settings-subscription-contact {
    flex-direction: column !important;
    align-items: center !important;
}
.subscription-gate-dialog .settings-contact-trigger {
    margin-bottom: 4px;
}
"""
    if custom_vip_layout not in content:
        content += "\n" + custom_vip_layout
        print("  - 已追加 VIP 弹窗微信二维码居中布局修复样式")

    with open(STYLE_CSS, "w", encoding="utf-8") as f:
        f.write(content)
    print("🎉 style.css 修改完成！")
    return True

def patch_api_url_js():
    print("🔧 正在处理 api/apiUrl.js...")
    # api/apiUrl.js 每次升级都会被混淆版覆盖，所以我们直接全量重写它
    make_backup(API_URL_JS)
    
    custom_api_url_code = """export function getApiBase() {
    try {
        if (typeof location !== 'undefined') {
            if (location.protocol === 'file:') {
                return 'http://127.0.0.1:8777';
            }
            // Dynamically detect subdirectory deployment (e.g. /manju/)
            const pathname = location.pathname;
            const parts = pathname.split('/');
            // If we are in a subdirectory like /manju/index.html or /manju/, parts[1] is 'manju'
            if (parts.length > 1 && parts[1] && !parts[1].endsWith('.html') && parts[1] !== 'index.html') {
                return '/' + parts[1];
            }
        }
    } catch (e) {}
    return '';
}

export function buildApiUrl(url) {
    const base = getApiBase();
    const cleanUrl = String(url || '');
    if (!cleanUrl) return base || '';
    if (!cleanUrl.startsWith('/')) {
        return base + '/' + cleanUrl;
    }
    return base + cleanUrl;
}
"""
    with open(API_URL_JS, "w", encoding="utf-8") as f:
        f.write(custom_api_url_code)
    print("🎉 api/apiUrl.js 重写完成！")
    return True

def patch_subscription_access_js():
    print("🔧 正在处理 subscriptionAccess.js...")
    if not os.path.exists(SUBSCRIPTION_ACCESS_JS):
        print("❌ 未找到 subscriptionAccess.js")
        return False
        
    make_backup(SUBSCRIPTION_ACCESS_JS)
    
    with open(SUBSCRIPTION_ACCESS_JS, "r", encoding="utf-8") as f:
        content = f.read()
        
    # 检查是否已经注入过新模型和工作流
    if "apimart/kling-o1" in content and "1971148165531475969" in content:
        print("  - subscriptionAccess.js 已注入过最新自定义 VIP 模型和工作流")
        return True
    
    # 方案：在硬编码的 subscriptionGateManifest.gates 数组末尾（dreaminaVideoVip gate之后）注入我们的新gates
    
    # 查找 dreaminaVideoVip gate 的结束位置
    # 匹配: 'modelPrefixes':[a571_0x2f8420(0x1f7)]}]};
    dreamina_end_pattern = r"'modelPrefixes':\[a571_0x2f8420\([^\)]+\)\]}\]\};"
    
    if not re.search(dreamina_end_pattern, content):
        print("❌ 未找到 dreaminaVideoVip gate 的结束位置")
        return False
    
    # 构造新的 gates JavaScript 代码（紧凑格式，匹配原文件风格）
    new_gates_js = """,{'key':'customApimartDoubaoVideo','modelId':'apimart/doubao-seedance-2.0','workflowId':'','displayName':'APImart 抖音 Seedance 视频','aliases':['apimart_doubao_video','doubao_seedance'],'providers':['apimart'],'modelPrefixes':['apimart/doubao-seedance-']},{'key':'customApimartKlingVideo','modelId':'apimart/kling-o1','workflowId':'','displayName':'APImart Kling 视频','aliases':['apimart_kling_video','kling_video'],'providers':['apimart'],'modelPrefixes':['apimart/kling-']},{'key':'customApimartOtherVideo','modelId':'apimart/happyhorse-1.0','workflowId':'','displayName':'APImart 其他视频模型','aliases':['apimart_other_video'],'providers':['apimart'],'modelPrefixes':['apimart/happyhorse-','apimart/veo','apimart/grok-','apimart/omni-','apimart/wan','apimart/minimax-','apimart/viduq']},{'key':'customAgnesVideo','modelId':'agnes/agnes-video-v2.0','workflowId':'','displayName':'Agnes 视频','aliases':['agnes_video'],'providers':['agnes'],'modelPrefixes':['agnes/']},{'key':'customVolcengineVideo','modelId':'volcengine/seedance-2.0','workflowId':'','displayName':'火山引擎 Seedance 视频','aliases':['volcengine_video','volcengine_seedance'],'providers':['volcengine'],'modelPrefixes':['volcengine/']},{'key':'customRunninghubModelVideo','modelId':'runninghub-model/seedance-2.0','workflowId':'','displayName':'RunningHub Model API 视频','aliases':['runninghub_model_video'],'providers':['runninghub'],'modelPrefixes':['runninghub-model/']},{'key':'runninghubVideoBasic','modelId':'runninghub/1971148165531475969','workflowId':'1971148165531475969','displayName':'RunningHub 基础视频','aliases':['video_basic','ai-app/1971148165531475969']},{'key':'runninghubVideoMatting','modelId':'runninghub/2037354967383674881','workflowId':'2037354967383674881','displayName':'RunningHub 视频抠图','aliases':['video_matting','ai-app/2037354967383674881']},{'key':'runninghubVideoMattingV2','modelId':'runninghub/2042569732972355585','workflowId':'2042569732972355585','displayName':'RunningHub 视频抠图V2','aliases':['video_matting_v2','ai-app/2042569732972355585']},{'key':'runninghubVideoLtx23','modelId':'runninghub/2039336644536442882','workflowId':'2039336644536442882','displayName':'RunningHub LTX 2.3视频','aliases':['video_ltx23','ai-app/2039336644536442882']},{'key':'runninghubVideoFrameInterpolation','modelId':'runninghub/2047784060881211393','workflowId':'2047784060881211393','displayName':'RunningHub 视频帧插值','aliases':['video_frame_interpolation','ai-app/2047784060881211393']},{'key':'runninghubVideoLipSync','modelId':'runninghub/2054101324521844738','workflowId':'2054101324521844738','displayName':'RunningHub 视频对口型','aliases':['video_lip_sync','ai-app/2054101324521844738']},{'key':'runninghubVideoWatermarkRemovalV2','modelId':'runninghub/2060613773890768898','workflowId':'2060613773890768898','displayName':'RunningHub 视频去水印V2','aliases':['video_watermark_removal_v2','ai-app/2060613773890768898']}"""
    
    # 在 dreaminaVideoVip gate 的 ]} 之前注入新的 gates
    content = re.sub(
        r"('modelPrefixes':\[a571_0x2f8420\([^\)]+\)\]})(\]\};)",
        r"\1" + new_gates_js + r"\2",
        content
    )
    
    if "apimart/kling-o1" not in content:
        print("❌ 注入新 gates 到硬编码 manifest 失败")
        return False
    
    print("  - 成功注入 13 个新 gates 到硬编码的 subscriptionGateManifest")
    
    # 清除末尾可能存在的旧注入代码
    old_inject_patterns = [
        """try{["apimart/omni-flash-ext","apimart/minimax-hailuo-2.3","apimart/kling-v1-5","apimart/doubao-seedance-2.0-fast-face","apimart/doubao-seedance-1-0-pro-fast","apimart/doubao-seedance-1-0-pro-quality","runninghub-model/happyhorse-1.0","runninghub-model/veo3","volcengine/seedance-2.0"].forEach(id=>{if(typeof VIDEO_VIP_MODEL_ID_SET!=='undefined')VIDEO_VIP_MODEL_ID_SET.add(id);if(typeof VIDEO_VIP_MODEL_IDS!=='undefined')VIDEO_VIP_MODEL_IDS.push(id);});}catch(e){}""",
        """try{["apimart/doubao-seedance-2.0-fast","apimart/doubao-seedance-2.0-fast-face","apimart/doubao-seedance-1-0-pro-quality","apimart/doubao-seedance-1-0-pro-fast","apimart/happyhorse-1.0","apimart/veo3-fast","apimart/grok-imagine-1.0","apimart/omni-flash-ext","apimart/wan2.7","apimart/kling-v3-omni","apimart/kling-v3","apimart/minimax-hailuo","apimart/minimax-hailuo-2.3","apimart/kling-v1-5","apimart/viduq3","volcengine/seedance-2.0","volcengine/seedance-2.0-fast","runninghub-model/seedance-2.0","runninghub-model/happyhorse-1.0","runninghub-model/veo3","runninghub-model/wan2.7","runninghub-model/hailuo-02","runninghub-model/hailuo-2.3","runninghub-model/kling-v3","runninghub-model/kling-o3","runninghub-model/kling-video-o1"].forEach(id=>{if(typeof VIDEO_VIP_MODEL_ID_SET!=='undefined')VIDEO_VIP_MODEL_ID_SET.add(id);if(typeof VIDEO_VIP_MODEL_IDS!=='undefined')VIDEO_VIP_MODEL_IDS.push(id);});}catch(e){}""",
        """try{["apimart/doubao-seedance-2.0","apimart/doubao-seedance-2.0-face","apimart/doubao-seedance-1-5-pro","apimart/kling-o1","agnes/agnes-video-v2.0","apimart/doubao-seedance-2.0-fast","apimart/doubao-seedance-2.0-fast-face","apimart/doubao-seedance-1-0-pro-quality","apimart/doubao-seedance-1-0-pro-fast","apimart/happyhorse-1.0","apimart/veo3-fast","apimart/grok-imagine-1.0","apimart/omni-flash-ext","apimart/wan2.7","apimart/kling-v3-omni","apimart/kling-v3","apimart/minimax-hailuo","apimart/minimax-hailuo-2.3","apimart/kling-v1-5","apimart/viduq3","volcengine/seedance-2.0","volcengine/seedance-2.0-fast","runninghub-model/seedance-2.0","runninghub-model/happyhorse-1.0","runninghub-model/veo3","runninghub-model/wan2.7","runninghub-model/hailuo-02","runninghub-model/hailuo-2.3","runninghub-model/kling-v3","runninghub-model/kling-o3","runninghub-model/kling-video-o1"].forEach(id=>{if(typeof VIDEO_VIP_MODEL_ID_SET!=='undefined')VIDEO_VIP_MODEL_ID_SET.add(id);if(typeof VIDEO_VIP_MODEL_IDS!=='undefined')VIDEO_VIP_MODEL_IDS.push(id);});}catch(e){}"""
    ]
    
    for old_code in old_inject_patterns:
        content = content.replace(old_code, "")
    
    print("  - 已清除旧的末尾注入代码（已不再需要，因为直接修改了 manifest）")
        
    with open(SUBSCRIPTION_ACCESS_JS, "w", encoding="utf-8") as f:
        f.write(content)
    print("🎉 subscriptionAccess.js 修改完成！")
    return True

def patch_vendor_video_manifests():
    print("🔧 正在处理 vendorVideoModelApiManifests.js...")
    if not os.path.exists(VENDOR_VIDEO_MANIFESTS_JS):
        print("❌ 未找到 vendorVideoModelApiManifests.js")
        return False
        
    make_backup(VENDOR_VIDEO_MANIFESTS_JS)
    
    with open(VENDOR_VIDEO_MANIFESTS_JS, "r", encoding="utf-8") as f:
        content = f.read()
        
    import re
    if "createVideoModelApiManifest({'vip':!![]," not in content:
        content = content.replace("=>createVideoModelApiManifest({", "=>createVideoModelApiManifest({'vip':!![],")
        print("  - 已注入 vip 标记到 vendorVideoModelApiManifests.js")
    else:
        print("  - 已跳过 vendorVideoModelApiManifests.js，已注入过 vip 标记")

    with open(VENDOR_VIDEO_MANIFESTS_JS, "w", encoding="utf-8") as f:
        f.write(content)
    return True

def patch_dreamina_video_manifest():
    print("🔧 正在处理 dreaminaVideoManifest.js...")
    if not os.path.exists(DREAMINA_VIDEO_MANIFEST_JS):
        return False
    make_backup(DREAMINA_VIDEO_MANIFEST_JS)
    with open(DREAMINA_VIDEO_MANIFEST_JS, "r", encoding="utf-8") as f:
        content = f.read()
    if "'vip':!![]" not in content:
        content = content.replace("=>createVideoModelApiManifest({", "=>createVideoModelApiManifest({'vip':!![],")
    with open(DREAMINA_VIDEO_MANIFEST_JS, "w", encoding="utf-8") as f:
        f.write(content)
    return True

def patch_runninghub_video_manifest():
    print("🔧 正在处理 runningHubVideoManifestShared.js...")
    if not os.path.exists(RUNNINGHUB_VIDEO_MANIFEST_JS):
        return False
    make_backup(RUNNINGHUB_VIDEO_MANIFEST_JS)
    with open(RUNNINGHUB_VIDEO_MANIFEST_JS, "r", encoding="utf-8") as f:
        content = f.read()
    if "'vip':!![]" not in content:
        content = content.replace("=>createVideoModelApiManifest({", "=>createVideoModelApiManifest({'vip':!![],")
    with open(RUNNINGHUB_VIDEO_MANIFEST_JS, "w", encoding="utf-8") as f:
        f.write(content)
    return True

def patch_parameterPanelModelHelpers_js():
    print("🔧 正在处理 parameterPanelModelHelpers.js...")
    file_path = "src/components/video-node/parameterPanelModelHelpers.js"
    if not os.path.exists(file_path):
        return False
    make_backup(file_path)
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    target1 = "'active':isApimartDreaminaVideoModel(_0x17b54b,_0x41c915),'attrs':{'data-apimart-jimeng':'1'}"
    if target1 in content:
        content = content.replace(target1, "'active':isApimartDreaminaVideoModel(_0x17b54b,_0x41c915),'vip':!![],'attrs':{'data-apimart-jimeng':'1'}")
        
    # 用正则替换所有动态获取 vip 的逻辑为强制 true
    import re
    content = re.sub(r"'vip':[a-zA-Z0-9_\[\]\(\)'\"]+===!!\[\]", r"'vip':!![]", content)
        
    # 修复前台部分下拉菜单漏掉 vip 的情况（比如 DreaminaTaskModelMenu）
    # 先清理可能存在的重复 'vip':!![] 标记
    content = re.sub(r"('vip':!!\s*\[\s*\]\s*,\s*)+", "'vip':!![],", content)
    target3 = "'attrs':{'data-dreamina-task-model':'1'}"
    if target3 in content and "'vip':!![],'attrs':" not in content:
        content = content.replace(target3, "'vip':!![],'attrs':{'data-dreamina-task-model':'1'}")
        
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    return True

def patch_parameterPanelModule_js():
    print("🔧 正在处理 parameterPanelModule.js...")
    if not os.path.exists(PARAMETER_PANEL_MODULE_JS):
        print("❌ 未找到 parameterPanelModule.js")
        return False
        
    make_backup(PARAMETER_PANEL_MODULE_JS)
    
    with open(PARAMETER_PANEL_MODULE_JS, "r", encoding="utf-8") as f:
        content = f.read()
        
    target = "if(!this['_guardVipSelection'](_0x402b61,_0xe9af87))"
    replacement = "if(!this['_guardVipSelection'](_0x402b61,_0x25d25c['dataset'][_0x344c5e(0x1cb)]||'',_0xe9af87))"
    
    if target in content:
        content = content.replace(target, replacement)
        print("  - 成功修复 parameterPanelModule.js 中的 VIP 校验参数传递 bug")
        with open(PARAMETER_PANEL_MODULE_JS, "w", encoding="utf-8") as f:
            f.write(content)
        return True
    elif replacement in content:
        print("  - parameterPanelModule.js 中的 VIP 校验参数已修复过，无需重复处理")
        return True
    else:
        print("❌ 未能在 parameterPanelModule.js 中找到目标 VIP 校验代码进行替换")
        return False

def patch_subscription_gate_manifest_json():
    """
    修复 subscriptionGateManifest.json，为自定义VIP模型添加gate条目
    解决前端不显示VIP badge的问题
    """
    print("🔧 正在处理 subscriptionGateManifest.json...")
    manifest_path = os.path.join(
        DIRECTORY, "src", "manifests", "subscription", "subscriptionGateManifest.json"
    )
    
    if not os.path.exists(manifest_path):
        print("❌ 未找到 subscriptionGateManifest.json")
        return False
    
    make_backup(manifest_path)
    
    # 读取现有的 manifest
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    
    # 确保 gates 数组存在
    if "gates" not in manifest or not isinstance(manifest["gates"], list):
        print("❌ subscriptionGateManifest.json 格式不正确")
        return False
    
    # 定义需要添加的gate条目（6个模型gate + 7个工作流gate）
    new_gates = [
        # ============ 模型 gates ============
        {
            "key": "customApimartDoubaoVideo",
            "modelId": "apimart/doubao-seedance-2.0",
            "workflowId": "",
            "displayName": "APImart 抖音 Seedance 视频",
            "aliases": [
                "apimart_doubao_video",
                "doubao_seedance"
            ],
            "providers": ["apimart"],
            "modelPrefixes": ["apimart/doubao-seedance-"]
        },
        {
            "key": "customApimartKlingVideo",
            "modelId": "apimart/kling-o1",
            "workflowId": "",
            "displayName": "APImart Kling 视频",
            "aliases": [
                "apimart_kling_video",
                "kling_video"
            ],
            "providers": ["apimart"],
            "modelPrefixes": ["apimart/kling-"]
        },
        {
            "key": "customApimartOtherVideo",
            "modelId": "apimart/happyhorse-1.0",
            "workflowId": "",
            "displayName": "APImart 其他视频模型",
            "aliases": [
                "apimart_other_video"
            ],
            "providers": ["apimart"],
            "modelPrefixes": [
                "apimart/happyhorse-",
                "apimart/veo",
                "apimart/grok-",
                "apimart/omni-",
                "apimart/wan",
                "apimart/minimax-",
                "apimart/viduq"
            ]
        },
        {
            "key": "customAgnesVideo",
            "modelId": "agnes/agnes-video-v2.0",
            "workflowId": "",
            "displayName": "Agnes 视频",
            "aliases": [
                "agnes_video"
            ],
            "providers": ["agnes"],
            "modelPrefixes": ["agnes/"]
        },
        {
            "key": "customVolcengineVideo",
            "modelId": "volcengine/seedance-2.0",
            "workflowId": "",
            "displayName": "火山引擎 Seedance 视频",
            "aliases": [
                "volcengine_video",
                "volcengine_seedance"
            ],
            "providers": ["volcengine"],
            "modelPrefixes": ["volcengine/"]
        },
        {
            "key": "customRunninghubModelVideo",
            "modelId": "runninghub-model/seedance-2.0",
            "workflowId": "",
            "displayName": "RunningHub Model API 视频",
            "aliases": [
                "runninghub_model_video"
            ],
            "providers": ["runninghub"],
            "modelPrefixes": ["runninghub-model/"]
        },
        # ============ 工作流 gates ============
        {
            "key": "runninghubVideoBasic",
            "modelId": "runninghub/1971148165531475969",
            "workflowId": "1971148165531475969",
            "displayName": "RunningHub 基础视频",
            "aliases": ["video_basic", "ai-app/1971148165531475969"]
        },
        {
            "key": "runninghubVideoMatting",
            "modelId": "runninghub/2037354967383674881",
            "workflowId": "2037354967383674881",
            "displayName": "RunningHub 视频抠图",
            "aliases": ["video_matting", "ai-app/2037354967383674881"]
        },
        {
            "key": "runninghubVideoMattingV2",
            "modelId": "runninghub/2042569732972355585",
            "workflowId": "2042569732972355585",
            "displayName": "RunningHub 视频抠图V2",
            "aliases": ["video_matting_v2", "ai-app/2042569732972355585"]
        },
        {
            "key": "runninghubVideoLtx23",
            "modelId": "runninghub/2039336644536442882",
            "workflowId": "2039336644536442882",
            "displayName": "RunningHub LTX 2.3视频",
            "aliases": ["video_ltx23", "ai-app/2039336644536442882"]
        },
        {
            "key": "runninghubVideoFrameInterpolation",
            "modelId": "runninghub/2047784060881211393",
            "workflowId": "2047784060881211393",
            "displayName": "RunningHub 视频帧插值",
            "aliases": ["video_frame_interpolation", "ai-app/2047784060881211393"]
        },
        {
            "key": "runninghubVideoLipSync",
            "modelId": "runninghub/2054101324521844738",
            "workflowId": "2054101324521844738",
            "displayName": "RunningHub 视频对口型",
            "aliases": ["video_lip_sync", "ai-app/2054101324521844738"]
        },
        {
            "key": "runninghubVideoWatermarkRemovalV2",
            "modelId": "runninghub/2060613773890768898",
            "workflowId": "2060613773890768898",
            "displayName": "RunningHub 视频去水印V2",
            "aliases": ["video_watermark_removal_v2", "ai-app/2060613773890768898"]
        }
    ]
    
    # 检查哪些gate需要添加（避免重复）
    existing_keys = {gate.get("key") for gate in manifest["gates"]}
    gates_to_add = [gate for gate in new_gates if gate["key"] not in existing_keys]
    
    if not gates_to_add:
        print("  - subscriptionGateManifest.json 已包含所有自定义VIP模型和工作流gate，无需添加")
        return True
    
    # 添加新的gate条目
    manifest["gates"].extend(gates_to_add)
    
    # 写回文件（格式化输出，保持可读性）
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    
    print(f"  - 成功添加 {len(gates_to_add)} 个VIP gate条目:")
    for gate in gates_to_add:
        gate_type = "工作流" if gate.get("workflowId") else "模型"
        print(f"    • {gate['key']}: {gate['displayName']} ({gate_type})")
    
    print("🎉 subscriptionGateManifest.json 修改完成！")
    return True

def patch_index_html():
    print("🔧 正在处理 index.html...")
    index_path = os.path.join(DIRECTORY, "index.html")
    if not os.path.exists(index_path):
        print("❌ 未找到 index.html")
        return False
        
    make_backup(index_path)
    
    with open(index_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # 移除错误的 VIP 注入脚本
    if "<!-- Video Node VIP CDKey Enforcer (Custom Patch) -->" in content:
        import re
        content = re.sub(r"<!-- ════════════════════════════════════════════════════════════════ -->\s*<!-- Video Node VIP CDKey Enforcer \(Custom Patch\) -->.*?</script>\s*", "", content, flags=re.DOTALL)
        print("  - 已清除之前的错误的 index.html VIP 注入脚本")

    # 移除关于对话框中的作者声明并保持间距
    target_author = '<div class="about-author">作者：<strong>阿硕</strong></div>'
    if target_author in content:
        # 用一个带有下边距的空 div 替换，以保持版本号和 Bilibili 按钮之间的间距
        content = content.replace(target_author, '<div class="about-author" style="visibility:hidden; height:0; margin-bottom:16px;"></div>')
        print("  - 已移除关于对话框中的原作者名称并修复布局间距")
        
    # 替换预设名称
    if '阿硕预设' in content:
        content = content.replace('阿硕预设', '预设')
        print("  - 已替换快捷键预设名称")

    # 替换所有的品牌名称 AI Canvas 为 pilipulu
    replacements = [
        ('Al Canvas - AI画布', 'pilipulu - AI画布'),
        ('Al Canvas', 'pilipulu')
    ]
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            print(f"  - 已将品牌名 '{old}' 替换为 '{new}'")

    # 替换 GitHub 官方链接
    old_github = 'https://github.com/ashuoAI/AI-CanvasPro'
    new_github = 'https://github.com/wangjinlong07/manju'
    if old_github in content:
        content = content.replace(old_github, new_github)
        print("  - 已将 GitHub 官方链接替换为自定义仓库地址")

    # 替换左上角 SVG Logo 为 images/favicon.svg
    import re
    logo_pattern = r'<div class="logo" id="logoLink"><svg.*?</svg>\s*<span class="logo-title">'
    new_logo = '<div class="logo" id="logoLink"><img src="images/favicon.svg" width="28" height="28" alt="pilipulu logo" style="margin-right:8px;"> <span class="logo-title">'
    if re.search(logo_pattern, content):
        content = re.sub(logo_pattern, new_logo, content)
        print("  - 已将左上角 SVG Logo 替换为 images/favicon.svg")
        
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("🎉 index.html 修改完成！")
    return True


if __name__ == "__main__":
    print("🚀 开始自动应用项目定制化（VIP校验与自托管配置）补丁...")
    s1 = patch_server_py()
    s2 = patch_gate_service_py()
    s3 = patch_style_css()
    s4 = patch_api_url_js()
    s5 = patch_subscription_access_js()
    s5_5 = patch_subscription_gate_manifest_json()  # 修复自定义VIP模型的manifest定义
    s6 = patch_vendor_video_manifests()
    s6_2 = patch_dreamina_video_manifest()
    s6_3 = patch_runninghub_video_manifest()
    s6_4 = patch_parameterPanelModelHelpers_js()
    s6_5 = patch_parameterPanelModule_js()
    s7 = patch_index_html()
    
    if all([s1, s2, s3, s4, s5, s5_5, s6, s6_2, s6_3, s6_4, s6_5, s7]):
        print("\n🏆 所有定制化修改已自动恢复应用成功！您可以正常启动 Docker / 本地运行。")
    else:
        print("\n⚠️ 某些文件在升级应用中发生异常，请检查控制台错误信息。")

def patch_docker_mac_origin_bug():
    print("[patch] Fixing missing Origin header bug in Docker...")
    content = ""
    with open("server.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    target = """    origin = handler.headers.get("Origin", "")
    if origin:
        return _is_allowed_origin(handler, origin) or _request_has_valid_local_token(handler)
    return _client_is_loopback(handler) or _request_has_valid_local_token(handler)"""
    
    replacement = """    origin = handler.headers.get("Origin", "")
    if origin:
        return _is_allowed_origin(handler, origin) or _request_has_valid_local_token(handler)
    host = handler.headers.get("Host", "")
    if host and _is_allowed_origin(handler, "http://" + host):
        return True
    return _client_is_loopback(handler) or _request_has_valid_local_token(handler)"""
    
    if target in content:
        content = content.replace(target, replacement)
        with open("server.py", "w", encoding="utf-8") as f:
            f.write(content)
        print("[patch] Successfully patched Docker origin bug.")
    else:
        print("[patch] Docker origin bug already patched or target not found.")

patch_docker_mac_origin_bug()
