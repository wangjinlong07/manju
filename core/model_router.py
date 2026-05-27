"""ModelRouter: 配置驱动万能路由 + 多维特征严格哈希防御 + Thinking 模式支持"""

import os
import yaml
import json
import hashlib
import re
from abc import ABC, abstractmethod
import requests

from loguru import logger
import litellm
from diskcache import Cache
from dotenv import load_dotenv

load_dotenv()

local_cache = Cache(os.path.join(os.getcwd(), ".cache"))


class CacheKeyEngine:
    @staticmethod
    def generate_llm_key(model_id: str, theme: str, thinking: bool) -> str:
        m = hashlib.sha256()
        m.update(str(model_id).strip().lower().encode("utf-8"))
        m.update(str(theme).strip().lower().encode("utf-8"))
        m.update(str(thinking).encode("utf-8"))
        return f"llm:{model_id}:think={thinking}:{m.hexdigest()}"

    @staticmethod
    def generate_image_key(model_id: str, prompt: str, character_face_url: str, seed: int) -> str:
        """【红线】必须严格隔离人像特征，防止缓存污染"""
        m = hashlib.sha256()
        m.update(str(model_id).strip().lower().encode("utf-8"))
        m.update(str(prompt).strip().lower().encode("utf-8"))
        m.update(str(character_face_url).strip().encode("utf-8"))
        m.update(str(seed).strip().encode("utf-8"))
        return f"img:{model_id}:{m.hexdigest()}"

    @staticmethod
    def generate_video_key(model_id: str, image_url: str, motion_type: str) -> str:
        m = hashlib.sha256()
        for arg in [model_id, image_url, motion_type]:
            m.update(str(arg).strip().lower().encode("utf-8"))
        return f"vid:{model_id}:{m.hexdigest()}"

    @staticmethod
    def generate_key(prefix: str, provider: str, *args) -> str:
        m = hashlib.sha256()
        m.update(str(provider).strip().lower().encode("utf-8"))
        for arg in args:
            m.update(str(arg).strip().lower().encode("utf-8"))
        return f"{prefix}:{provider}:{m.hexdigest()}"


# ================= 视频适配器 =================


class BaseVideoProvider(ABC):
    @abstractmethod
    def generate_video(self, image_url: str, motion_type: str, api_base: str, api_key: str, model_name: str, duration: str = "5", prompt: str = "", **kwargs) -> str:
        pass


class KlingVideoProvider(BaseVideoProvider):
    def _generate_jwt(self, access_key: str, secret_key: str) -> str:
        """生成可灵 API 认证用的 JWT token (HS256, 30min有效期)"""
        import time
        import jwt  # PyJWT
        payload = {
            "iss": access_key,
            "exp": int(time.time()) + 1800,
            "nbf": int(time.time()) - 5,
        }
        return jwt.encode(payload, secret_key, algorithm="HS256",
                          headers={"typ": "JWT", "alg": "HS256"})

    def generate_video(self, image_url, motion_type, api_base, api_key, model_name, duration="5", prompt="", **kwargs):
        import requests
        # 可灵使用 access_key + secret_key JWT 认证
        access_key = os.getenv("KLING_ACCESS_KEY", "")
        secret_key = os.getenv("KLING_SECRET_KEY", "")
        if not access_key or not secret_key:
            raise Exception("KLING_ACCESS_KEY 或 KLING_SECRET_KEY 未配置")

        token = self._generate_jwt(access_key, secret_key)
        logger.info(f"-> [KlingAdapter] {model_name} @ {api_base} (JWT auth, duration={duration}s)")

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        payload = {
            "model_name": model_name,
            "image": image_url,
            "mode": "std",
            "duration": duration,
        }
        if prompt:
            payload["prompt"] = prompt
        resp = requests.post(f"{api_base}/videos/image2video", headers=headers, json=payload, timeout=120)
        if resp.status_code not in (200, 201):
            raise Exception(f"Kling API 失败 ({resp.status_code}): {resp.text}")
        data = resp.json()
        # 可灵返回异步 task_id，需要轮询获取结果
        task_id = data.get("data", {}).get("task_id", "")
        if task_id:
            return self._poll_task(api_base, access_key, secret_key, task_id)
        return data.get("data", {}).get("video_url", "kling-unknown")

    def _poll_task(self, api_base: str, access_key: str, secret_key: str, task_id: str) -> str:
        """轮询可灵异步任务直到完成"""
        import requests
        import time
        for _ in range(60):  # 最多等5分钟
            token = self._generate_jwt(access_key, secret_key)
            headers = {"Authorization": f"Bearer {token}"}
            resp = requests.get(f"{api_base}/videos/image2video/{task_id}", headers=headers, timeout=30)
            if resp.status_code != 200:
                raise Exception(f"Kling 轮询失败 ({resp.status_code}): {resp.text}")
            data = resp.json().get("data", {})
            status = data.get("task_status", "")
            if status == "succeed":
                videos = data.get("task_result", {}).get("videos", [])
                if videos:
                    return videos[0].get("url", "")
                raise Exception("Kling 任务完成但无视频 URL")
            elif status == "failed":
                raise Exception(f"Kling 任务失败: {data.get('task_status_msg', '')}")
            time.sleep(5)
        raise Exception("Kling 任务超时（5分钟未完成）")


class SeedanceVideoProvider(BaseVideoProvider):
    def generate_video(self, image_url, motion_type, api_base, api_key, model_name, duration="5", prompt="", **kwargs):
        import requests
        logger.info(f"-> [SeedanceAdapter] {model_name} @ {api_base} (duration={duration}s)")
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model_name,
            "content": [{"type": "image_url", "image_url": {"url": image_url}}],
            "parameters": {"motion_type": motion_type, "duration": int(duration)}
        }
        if prompt:
            payload["prompt"] = prompt
        resp = requests.post(f"{api_base}/contents/generations/tasks", headers=headers, json=payload, timeout=120)
        if resp.status_code not in (200, 201):
            raise Exception(f"Seedance API 失败 ({resp.status_code}): {resp.text}")
        data = resp.json()
        return data.get("data", {}).get("video_url", data.get("task_id", "seedance-pending"))


class GrokVideoProvider(BaseVideoProvider):
    def generate_video(self, image_url, motion_type, api_base, api_key, model_name, duration="5", prompt="", **kwargs):
        import requests
        logger.info(f"-> [GrokImagineVideo] {model_name} @ {api_base} (duration={duration}s)")
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model_name,
            "prompt": prompt or motion_type,
            "image_url": image_url,
            "duration": int(duration),
        }
        resp = requests.post(f"{api_base}/images/generations", headers=headers, json=payload, timeout=120)
        if resp.status_code not in (200, 201):
            raise Exception(f"Grok Video API 失败 ({resp.status_code}): {resp.text}")
        data = resp.json()
        if "data" in data and len(data["data"]) > 0:
            return data["data"][0].get("url", "")
        return data.get("video_url", "grok-video-pending")


class CogVideoX3Provider(BaseVideoProvider):
    """智谱 CogVideoX-3 适配器 — 根据输入自动判断：文生视频/图生视频/首尾帧"""

    def generate_video(self, image_url, motion_type, api_base, api_key, model_name, duration="5", prompt="", **kwargs):
        import requests
        import time as _time

        # duration 只支持 5 或 10
        dur = int(duration) if int(duration) in (5, 10) else 5

        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": model_name,
            "quality": "quality",
            "with_audio": True,
            "size": "1920x1080",
            "fps": 30,
            "duration": dur,
        }

        # 自动判断模式：
        # - 有逗号分隔的两个URL → 首尾帧
        # - 有单个image_url → 图生视频
        # - 无图 → 文生视频
        if image_url and "," in image_url:
            urls = [u.strip() for u in image_url.split(",") if u.strip()]
            payload["image_url"] = urls
            if prompt:
                payload["prompt"] = prompt
            mode = "首尾帧"
        elif image_url:
            payload["image_url"] = image_url
            if prompt:
                payload["prompt"] = prompt
            mode = "图生视频"
        else:
            payload["prompt"] = prompt or motion_type
            mode = "文生视频"

        logger.info(f"-> [CogVideoX3] {mode}, model={model_name}, duration={dur}s")

        resp = requests.post(f"{api_base}/videos/generations", headers=headers, json=payload, timeout=30)
        if resp.status_code not in (200, 201):
            raise Exception(f"CogVideoX-3 API 失败 ({resp.status_code}): {resp.text}")

        data = resp.json()
        task_id = data.get("id", "")
        if not task_id:
            raise Exception(f"CogVideoX-3 未返回 task_id: {data}")

        logger.info(f"[CogVideoX3] 异步任务已提交: {task_id}")
        return self._poll_result(api_base, api_key, task_id)

    def _poll_result(self, api_base: str, api_key: str, task_id: str) -> str:
        """轮询智谱异步结果直到完成"""
        import requests
        import time as _time

        headers = {"Authorization": f"Bearer {api_key}"}
        for _ in range(120):  # 最多等10分钟
            resp = requests.get(f"{api_base}/async-result/{task_id}", headers=headers, timeout=30)
            if resp.status_code != 200:
                raise Exception(f"CogVideoX-3 轮询失败 ({resp.status_code}): {resp.text}")
            data = resp.json()
            status = data.get("task_status", "")
            if status == "SUCCESS":
                video_result = data.get("video_result", [])
                if video_result and video_result[0].get("url"):
                    return video_result[0]["url"]
                raise Exception("CogVideoX-3 任务成功但无视频 URL")
            elif status == "FAIL":
                raise Exception(f"CogVideoX-3 任务失败: {data}")
            _time.sleep(5)
        raise Exception("CogVideoX-3 任务超时（10分钟未完成）")


# ================= 核心路由器 =================


class ModelRouter:
    def __init__(self):
        with open("models.yaml", "r", encoding="utf-8") as f:
            self.registry = yaml.safe_load(f)
        self._video_providers = {
            "KlingVideoProvider": KlingVideoProvider(),
            "SeedanceVideoProvider": SeedanceVideoProvider(),
            "GrokVideoProvider": GrokVideoProvider(),
            "CogVideoX3Provider": CogVideoX3Provider(),
        }
        logger.info("✅ 动态模型注册表加载完成 (models.yaml)")

    def get_models_for_frontend(self) -> dict:
        """返回前端需要的模型列表 + Skills 按类型分组（script/image/video）"""
        result = {"llm": [], "image": [], "video": [], "skills": {"script": [], "image": [], "video": []}}
        for key, conf in self.registry.get("llm", {}).items():
            result["llm"].append({
                "id": key,
                "display_name": conf.get("display_name", key),
                "supports_thinking": conf.get("supports_thinking", False),
            })
        for key, conf in self.registry.get("image", {}).items():
            result["image"].append({
                "id": key,
                "display_name": conf.get("display_name", key),
            })
        for key, conf in self.registry.get("video", {}).items():
            result["video"].append({
                "id": key,
                "display_name": conf.get("display_name", key),
            })
        # 扫描 skills/ 三个子目录
        skills_dir = os.path.join(os.getcwd(), "skills")
        for category in ("script", "image", "video"):
            cat_dir = os.path.join(skills_dir, category)
            if not os.path.isdir(cat_dir):
                continue
            for filename in sorted(os.listdir(cat_dir)):
                if filename.endswith(".md") or filename.endswith(".txt"):
                    skill_id = os.path.splitext(filename)[0]
                    filepath = os.path.join(cat_dir, filename)
                    display_name = skill_id
                    with open(filepath, "r", encoding="utf-8") as f:
                        first_line = f.readline().strip()
                        if first_line.startswith("#"):
                            display_name = first_line.lstrip("# ").strip()
                    result["skills"][category].append({"id": skill_id, "display_name": display_name, "type": category})
        return result

    def _get_skill(self, skill_id: str) -> dict:
        """从 skills/{script,image,video}/ 子目录读取 skill 文件并解析为结构化数据"""
        if not skill_id:
            return {}
        skills_dir = os.path.join(os.getcwd(), "skills")
        for category in ("script", "image", "video"):
            for ext in (".md", ".txt"):
                filepath = os.path.join(skills_dir, category, skill_id + ext)
                if os.path.isfile(filepath):
                    with open(filepath, "r", encoding="utf-8") as f:
                        content = f.read()
                    return self._parse_skill_file(content)
        return {}

    def _parse_skill_file(self, content: str) -> dict:
        """解析 skill markdown 文件为 {llm_system, image_prefix, negative_prompt}"""
        result = {"llm_system": "", "image_prefix": "", "negative_prompt": ""}
        current_section = None
        lines = content.split("\n")
        for line in lines:
            lower = line.lower().strip()
            if "剧本指导" in lower or "llm system" in lower:
                current_section = "llm_system"
                continue
            elif "生图提示词前缀" in lower or "image prompt prefix" in lower:
                current_section = "image_prefix"
                continue
            elif "负面提示词" in lower or "negative prompt" in lower:
                current_section = "negative_prompt"
                continue
            elif line.startswith("# "):
                current_section = None
                continue

            if current_section and line.strip():
                if result[current_section]:
                    result[current_section] += "\n" + line.strip()
                else:
                    result[current_section] = line.strip()
        return result

    def _get_config(self, category: str, model_id: str):
        config = self.registry.get(category, {}).get(model_id)
        if not config:
            raise ValueError(f"models.yaml 中缺失配置: {category} -> {model_id}")
        # 兼容单 key 和双 key（可灵 JWT）两种模式
        if "api_key_env" in config:
            api_key = os.getenv(config["api_key_env"])
        else:
            api_key = None  # 可灵等使用 access_key + secret_key
        return config, api_key

    def generate_script(self, model_id: str, theme: str, thinking: bool = False, skill: str = "") -> list[dict]:
        """剧本生成引擎 — LiteLLM completion + DiskCache + Thinking 模式 + Skill 注入"""
        config, api_key = self._get_config("llm", model_id)
        skill_conf = self._get_skill(skill)

        cache_key = CacheKeyEngine.generate_llm_key(model_id, theme + skill, thinking)
        if cached := local_cache.get(cache_key):
            logger.success(f"💰 [剧本缓存命中] 复用历史思考结果!")
            return cached

        logger.info(f"🧠 调用 LiteLLM 剧本大脑: {config['model_name']} @ {config['api_base']} | thinking={thinking} | skill={skill}")

        system_prompt = (
            '你是一个专业漫剧分镜师。根据用户主题生成6-10个连贯的分镜剧本。\n'
            '【硬性规则】\n'
            '1. 必须输出纯JSON数组，不要输出任何其他内容\n'
            '2. 所有文本字段必须使用中文（image_prompt 除外）\n'
            '3. 每个分镜必须包含以下完整字段：\n'
            '   - scene_id: 编号如 s1, s2...\n'
            '   - scene_description: 中文场景描述（时间、地点、氛围、发生了什么，详细到画师能直接还原）\n'
            '   - shot_type: 镜头类型（特写/近景/中景/远景/全景/过肩镜头）\n'
            '   - character_name: 中文角色名（旁白写"旁白"）\n'
            '   - dialogue: 中文角色台词或旁白文本（要有戏剧张力）\n'
            '   - character_appearance: 中文角色外貌描述（服装、发色、体型、面部特征、表情，跨分镜必须一致）\n'
            '   - image_prompt: 详细英文生图提示词（含镜头类型、角色外貌、环境、光线、构图，供AI绘画模型使用）\n'
            '   - image_prompt_cn: 中文版生图描述（用户阅读用，内容与image_prompt对应）\n'
            '   - motion_type: 运镜方式（zoom_in/zoom_out/pan_left/pan_right/tilt_up/static）\n'
            '4. 分镜之间要有镜头变化节奏：远-近-特写交替\n'
            '5. 角色外貌特征跨所有分镜保持绝对一致\n'
            '6. scene_description 和 dialogue 必须中文，要丰富有画面感\n'
            '7. character_appearance 必须中文，每个分镜都要写（即使重复）\n'
            '\n输出格式示例:\n'
            '[{"scene_id":"s1","scene_description":"黄昏时分，破旧的县城老街，斑驳的青砖墙映着橙红色的夕阳。一个穿灰色旧T恤的中年男人蹲在自家门口，逗弄一只趴在地上的土黄色小狗。","shot_type":"远景","character_name":"旁白","dialogue":"1987年的夏天，老街还是老样子，没有人知道明天会发生什么。","character_appearance":"男人约40岁，寸头短发微微花白，身形偏瘦但筋骨结实，穿灰色旧T恤和深蓝色工装裤，面容沧桑有皱纹但眼神温和","image_prompt":"wide shot, a middle-aged thin man in grey t-shirt and dark blue work pants, squatting near a doorway petting a yellow dog, old Chinese county town street at dusk, warm golden hour lighting, film grain, nostalgic atmosphere, 1980s China","image_prompt_cn":"远景，穿灰色T恤和深蓝工装裤的中年瘦削男人蹲在门口逗一只黄狗，中国县城老街黄昏，暖金色夕阳光线，胶片颗粒感，怀旧氛围，80年代中国","motion_type":"pan_right"}]'
        )

        # Skill 注入：将 skill 文件的剧本指导追加到 system prompt
        if skill_conf.get("llm_system"):
            system_prompt += "\n\n【风格要求】\n" + skill_conf["llm_system"]

        # 构造 LiteLLM 请求参数
        kwargs = {
            "model": config["model_name"],
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": theme},
            ],
            "api_base": config["api_base"],
            "api_key": api_key,
        }

        # DeepSeek V4 thinking 模式
        if thinking and config.get("supports_thinking"):
            kwargs["extra_body"] = {"thinking": {"type": "enabled"}}
            logger.info("🧠 Thinking 模式已启用")

        response = litellm.completion(**kwargs)

        content = response.choices[0].message.content.strip()

        # 提取 markdown 代码块
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
        if json_match:
            content = json_match.group(1).strip()

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            start_idx = min(
                (content.find("[") if content.find("[") >= 0 else len(content)),
                (content.find("{") if content.find("{") >= 0 else len(content)),
            )
            if start_idx < len(content):
                parsed = json.loads(content[start_idx:])
            else:
                raise

        scenes = parsed if isinstance(parsed, list) else parsed.get("scenes", [parsed])

        local_cache.set(cache_key, scenes)
        logger.info(f"[Cache Write] 剧本已缓存 | Key: {cache_key[:60]}...")
        return scenes

    def generate_image(self, model_id: str, prompt: str, n: int = 1, ratio: str = "16:9", resolution: str = "2K", reference_images=None, skill: str = "") -> list[str]:
        """生图引擎 — N 张不同候选 + Skill 前缀 + ratio/resolution 穿透 + @参考图N 解析"""
        import uuid as uuid_mod
        config, api_key = self._get_config("image", model_id)
        skill_conf = self._get_skill(skill)
        if reference_images is None:
            reference_images = []

        # 九视图检测：强制 1:1 比例
        if "九宫格" in prompt or "九视图" in prompt or "3x3" in prompt:
            ratio = "1:1"
            logger.info("[NineView] 强制 1:1 比例")

        # Skill 注入：将 image_prefix 拼到 prompt 前面
        final_prompt = prompt
        if skill_conf.get("image_prefix"):
            final_prompt = skill_conf["image_prefix"] + ", " + prompt

        # @参考图N 标记解析：替换为实际 URL（只注入用户主动引用的参考图）
        ref_used = set()
        def replace_ref(match):
            idx = int(match.group(1)) - 1
            if 0 <= idx < len(reference_images):
                ref_used.add(idx)
                return reference_images[idx]
            return match.group(0)
        final_prompt = re.sub(r'@参考图(\d+)', replace_ref, final_prompt)

        # 如果 prompt 中没有 @参考图 标记但有参考图，则按旧逻辑全部列出
        if reference_images and not ref_used:
            ref_lines = []
            for i, url in enumerate(reference_images, 1):
                ref_lines.append(f"参考图{i}: {url}")
            final_prompt += "\n[参考图列表]\n" + "\n".join(ref_lines) + "\n[要求：生成结果必须与上述参考图保持角色外貌、场景风格、色调一致]"
            logger.info(f"[RefImages] 注入 {len(reference_images)} 张参考图到 prompt")
        elif ref_used:
            logger.info(f"[RefImages] @引用模式，使用了 {len(ref_used)} 张参考图")

        results = []
        for i in range(n):
            # 每张候选使用唯一 random_id 避免缓存命中同一结果
            random_id = str(uuid_mod.uuid4())[:8]
            cache_key = CacheKeyEngine.generate_image_key(model_id, final_prompt, "", hash(random_id))

            adapter_type = config.get("adapter", "openai")
            logger.info(f"🎨 生图 {i+1}/{n}: {config['model_name']} (adapter={adapter_type}) [uid={random_id}]")

            try:
                if adapter_type == "gemini":
                    url = self._generate_image_gemini(config, api_key, final_prompt)
                else:
                    url = self._generate_image_openai(config, api_key, final_prompt, ratio, resolution)
            except Exception as e:
                if "429" in str(e) or "rate limit" in str(e).lower():
                    # 限流：等待后重试一次
                    import time
                    logger.warning(f"⚠️ 限流，等待 3s 后重试... ({i+1}/{n})")
                    time.sleep(3)
                    try:
                        if adapter_type == "gemini":
                            url = self._generate_image_gemini(config, api_key, final_prompt)
                        else:
                            url = self._generate_image_openai(config, api_key, final_prompt, ratio, resolution)
                    except Exception:
                        if results:
                            logger.warning(f"⚠️ 重试仍失败，已生成 {len(results)} 张，提前返回")
                            break
                        raise
                else:
                    raise

            local_cache.set(cache_key, url)
            results.append(url)

            # 多张时加间隔防限流
            if n > 1 and i < n - 1:
                import time
                time.sleep(1)

        return results

    def _generate_image_openai(self, config: dict, api_key: str, prompt: str, ratio: str = "16:9", resolution: str = "2K") -> str:
        """OpenAI-compatible /images/generations 端点 (GPT Image 2, Grok, FLUX 等)"""
        import requests

        # ratio → size 映射
        SIZE_MAP = {
            "16:9": {"2K": "1792x1024", "4K": "1792x1024"},
            "9:16": {"2K": "1024x1792", "4K": "1024x1792"},
            "1:1": {"2K": "1024x1024", "4K": "1024x1024"},
            "4:3": {"2K": "1536x1024", "4K": "1536x1024"},
        }
        size = SIZE_MAP.get(ratio, SIZE_MAP["16:9"]).get(resolution, "1024x1024")
        quality = "hd" if resolution == "4K" else "standard"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": config["model_name"],
            "prompt": prompt,
            "size": size,
            "quality": quality,
        }
        resp = requests.post(
            f"{config['api_base']}/images/generations",
            headers=headers,
            json=payload,
            timeout=120,
        )
        if resp.status_code != 200:
            raise Exception(f"生图 API 失败 ({resp.status_code}): {resp.text}")

        data = resp.json()
        if "data" in data and len(data["data"]) > 0:
            return data["data"][0].get("url") or data["data"][0].get("b64_json", "")
        raise Exception(f"生图 API 返回格式异常: {data}")

    def _generate_image_gemini(self, config: dict, api_key: str, prompt: str) -> str:
        """Google Gemini Nano Banana — generateContent with responseModalities=["IMAGE"]"""
        import requests
        import base64
        model_name = config["model_name"]
        api_base = config["api_base"]
        url = f"{api_base}/models/{model_name}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["IMAGE"]},
        }
        resp = requests.post(url, json=payload, timeout=120)
        if resp.status_code != 200:
            raise Exception(f"Gemini 生图 API 失败 ({resp.status_code}): {resp.text}")

        data = resp.json()
        # Gemini 返回 candidates[0].content.parts[N].inlineData.data (base64)
        try:
            parts = data["candidates"][0]["content"]["parts"]
            for part in parts:
                if "inlineData" in part:
                    b64 = part["inlineData"]["data"]
                    mime = part["inlineData"].get("mimeType", "image/png")
                    return f"data:{mime};base64,{b64}"
        except (KeyError, IndexError):
            pass
        raise Exception(f"Gemini 生图返回格式异常: {json.dumps(data)[:500]}")

    def generate_video(self, model_id: str, image_url: str, motion_type: str, duration: str = "5", prompt: str = "") -> str:
        """视频生成引擎 — 自定义适配器多态 + DiskCache + duration/prompt 穿透"""
        config, api_key = self._get_config("video", model_id)

        cache_key = CacheKeyEngine.generate_video_key(model_id, image_url, motion_type)
        if cached := local_cache.get(cache_key):
            logger.success(f"💰 [视频缓存命中] 省下巨额费用! Key: {cache_key[:60]}...")
            return cached

        adapter_name = config["adapter"]
        provider = self._video_providers.get(adapter_name)
        if not provider:
            raise Exception(f"系统中未找到名为 {adapter_name} 的视频适配器类！")

        model_name = config.get("model_name", "")
        video_url = provider.generate_video(image_url, motion_type, config["api_base"], api_key, model_name, duration=duration, prompt=prompt, config=config)
        local_cache.set(cache_key, video_url)
        logger.info(f"[Cache Write] 视频已缓存 | Key: {cache_key[:60]}...")
        return video_url
