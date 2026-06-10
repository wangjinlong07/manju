#!/bin/bash
# ==============================================================================
# AI-CanvasPro (manju) 一键升级同步与定制化自动修复工具
# ==============================================================================
#
# 此脚本用于将本项目与原作者的最新代码进行同步，并自动恢复应用您的所有定制化改动。
# 您只需在终端中运行：./sync_upstream.sh
#

# 确保脚本在项目根目录下执行
cd "$(dirname "$0")"

# 定义各种颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 开始检查项目与原作者最新代码的同步状态...${NC}"

# 1. 确保已添加 upstream 远程源
if ! git remote | grep -q "^upstream$"; then
    echo -e "${YELLOW}正在为您配置原作者的 upstream 源...${NC}"
    git remote add upstream https://github.com/ashuoAI/AI-CanvasPro.git
fi

# 2. 获取原作者最新代码
echo -e "${YELLOW}📥 正在从原作者仓库 (upstream) 获取最新代码...${NC}"
git fetch upstream

# 获取当前本地和 upstream 的最新状态
LOCAL_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)
if [ -z "$LOCAL_BRANCH" ]; then
    echo -e "${RED}❌ 错误: 您当前不在任何 Git 分支上，请先切换到主分支 (main)。${NC}"
    exit 1
fi

PREV_COMMIT=$(git rev-parse HEAD)
UPSTREAM_COMMIT=$(git rev-parse upstream/master)

if [ "$PREV_COMMIT" = "$UPSTREAM_COMMIT" ]; then
    echo -e "${GREEN}✨ 本地代码已经与原作者最新版本完全一致，无需升级。${NC}"
    exit 0
fi

echo -e "${YELLOW}🔧 正在尝试进行标准的 Git 变基合并...${NC}"
# 尝试标准 rebase
git rebase upstream/master > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}🏆 变基合并成功！您的所有历史提交已干净地应用到了原作者最新版本之上。${NC}"
    echo -e "${GREEN}提示: 您可以运行以下命令将更新推送到您的 GitHub:${NC}"
    echo -e "      git push -f origin $LOCAL_BRANCH"
    exit 0
fi

# 3. 如果变基失败，说明代码冲突严重。启动一键无冲突覆盖+自动打补丁工作流
echo -e "${YELLOW}⚠️ 标准变基遇到冲突。正在启动 [无冲突一键强力升级+自动补丁] 模式...${NC}"
git rebase --abort

# 3.1 强制重置到原作者最新版
echo -e "${YELLOW}🔄 正在将代码重置到原作者最新版 (丢弃冲突的源码改动)...${NC}"
git reset --hard upstream/master

# 3.2 从升级前备份中恢复定制化工具和 Docker 相关配置文件
echo -e "${YELLOW}📦 正在恢复您的独立配置文件 (如 Docker、卡密生成器、补丁脚本等)...${NC}"
git checkout "$PREV_COMMIT" -- \
    Dockerfile \
    docker-compose.yml \
    dockerbuild.md \
    .gitignore \
    .env \
    key_generator.html \
    apply_customizations.py \
    sync_upstream.sh \
    README.md \
    images/favicon.svg \
    images/wechat.png \
    .dockerignore > /dev/null 2>&1

# 3.3 运行补丁注入脚本，对最新源码进行定制修改
echo -e "${YELLOW}🩹 正在运行 apply_customizations.py 自动修改最新源码...${NC}"
if [ -f "apply_customizations.py" ]; then
    python3 apply_customizations.py
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 定制化补丁应用成功！${NC}"
    else
        echo -e "${RED}❌ 补丁应用失败，请检查上面错误信息。${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 错误: 找不到 apply_customizations.py 脚本文件，无法完成自动修改。${NC}"
    exit 1
fi

# 3.4 提交并建议推送
echo -e "${YELLOW}📝 正在自动生成 Git 提交记录...${NC}"
git add .
git commit -m "upgrade: sync with upstream/master and apply customizations"

echo -e "${GREEN}🎉 升级与定制化自动修复全部完成！${NC}"
echo -e "${GREEN}提示: 建议您执行以下命令更新您的 GitHub 远程仓库:${NC}"
echo -e "      git push -f origin $LOCAL_BRANCH"
echo -e "${NC}"
