# AICanvas 本地 Docker 容器化运行指南

---

## ⚡ 快速启动步骤

确保您已经安装了 Docker Desktop（或其他本地 Docker 环境）。在项目根目录下执行以下三步即可启动：

```bash
# 1. 产生/配置您的签名秘钥（或者直接编辑 docker-compose.yml 文件）
export AIC_SIGNING_SECRET="您的安全强密钥"

# 2. 一键构建并启动容器
docker-compose up -d --build

# 3. 检查容器状态或查看实时日志
docker-compose ps
docker-compose logs -f
```

---

## 🔑 核心环境变量配置

在启动前，建议了解卡密（CDKEY）的签名校验等参数配置（可以直接在 `docker-compose.yml` 文件里修改 `environment`）：

| 环境变量名               | 默认值                              | 作用与配置说明                                                                     |
| :----------------------- | :---------------------------------- | :--------------------------------------------------------------------------------- |
| `AIC_SIGNING_SECRET`     | `change-me-to-a-long-random-secret` | **最核心的安全秘钥**。用于生成与核验激活码签名。**请务必修改为一个长随机字符串**。 |
| `AIC_BIND_HOST`          | `0.0.0.0`                           | 容器内绑定地址，保持 `0.0.0.0` 以确保容器正常接收请求。                            |
| `AICANVAS_PORT`          | `8777`                              | 服务监听端口。启动后您可以在本地通过 `http://127.0.0.1:8777` 访问。                |
| `AIC_SUB_CONTACT_WECHAT` | `YourWeChatId`                      | 订阅拦截弹窗中展示的微信联系人 ID。                                                |
| `AIC_SUB_CONTACT_URL`    | `/manju/images/wechat.png`          | 订阅拦截弹窗中微信二维码图片的 URL。                                               |

---

## 🚀 日常运行与维护

Docker Compose 将自动在项目目录下创建 `data`、`user` 和 `output` 目录，并将它们挂载到容器中：

- **`data/`**：存放本地订阅数据库 `subscriptions.json`（激活状态与有效期）。
- **`user/`**：存放用户全局配置文件 `config.json` 和 `settings.json`。
- **`output/`**：存放本地媒体生成的输出内容。

> [!IMPORTANT]
> 每次您修改了 Python 代码或 `apply_customizations.py` 后，执行 `docker-compose up -d --build` 重新构建时，上述三个文件夹中的核心数据**绝对不会丢失**。

### 常用命令

```bash
# 后台启动服务
docker-compose up -d

# 查看实时运行日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart
```

---

## 💾 数据备份

在本地环境如果需要重装系统或转移项目，您只需备份当前目录下的 **`data`** 和 **`user`** 文件夹即可：

```bash
# 打包备份核心激活数据与用户配置
tar -czvf manju_backup_$(date +%F).tar.gz data/ user/
```
