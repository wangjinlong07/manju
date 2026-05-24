-- PupuLin 噗噗凛 数据库建表
-- PostgreSQL 15+

-- 文稿（项目）
CREATE TABLE projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,              -- 文稿名称（用户可编辑）
    canvas_json JSONB NOT NULL DEFAULT '{}',        -- 画布完整状态（nodes + edges 的 JSON）
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 生成产物（图片/视频 URL 记录）
CREATE TABLE assets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL,               -- 'image' | 'video' | 'script'
    url         TEXT NOT NULL,                      -- 生成结果的 URL（外部 API 返回的）
    prompt      TEXT NOT NULL DEFAULT '',           -- 生成时使用的 prompt
    provider    VARCHAR(50) NOT NULL DEFAULT '',    -- 使用的模型 ID（如 gpt-image-2）
    node_id     VARCHAR(100) NOT NULL DEFAULT '',   -- 对应画布上的节点 ID（关联前端）
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_assets_project ON assets(project_id);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);
