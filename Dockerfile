FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/python:3.9-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量，确保 Python 输出直接打印到控制台，不进行缓冲
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Asia/Shanghai \
    AIC_BIND_HOST=0.0.0.0 \
    AICANVAS_PORT=8777

# 安装系统依赖：ffmpeg、opencv 所需的 libgl1 与 glib 等基础库
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖说明文件并安装 Python 依赖
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# 复制整个项目（除了 .dockerignore 指定的文件）
COPY . /app/

# 暴露运行端口
EXPOSE 8777

# 启动服务
CMD ["python", "server.py"]
