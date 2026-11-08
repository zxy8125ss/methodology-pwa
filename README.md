# 方法论 PWA

个人 AI 驱动的方法论知识管理与实践系统。

AI 主动完成方法论的**检索、交叉验证、整理、归档与关联**，你只需在审核队列里做判断。系统通过真实的实践记录来检验方法论是否真的有效。

## 核心闭环

```
发现 → 研究 → 整理 → 审核 → 入库 → 关联 → 学习 → 应用 → 验证 → 更新
```

前六个环节由 AI 自动完成。你负责：

- 审核 AI 整理的知识（通过 / 修改后入库 / 退回 / 合并 / 忽略）
- 提出实际问题
- 学习和应用方法论
- 反馈实践结果

## 仓库结构

本仓库是**站点仓库**（public），承载 PWA 前端与 GitHub Actions。

| 路径 | 说明 |
|---|---|
| `src/` | React + TypeScript 前端（六大模块） |
| `shared/` | 前后端共用的类型、Schema、AI/Search Provider、数据仓适配层 |
| `worker/` | Cloudflare Worker 安全代理层（持有密钥） |
| `scripts/` | 数据索引、校验、备份、每周研究、种子数据 |
| `.github/workflows/` | Pages 部署、每周研究、数据校验、备份 |
| `docs/` | 产品与技术文档、部署维护说明、测试报告 |

**数据不在本仓库**，而在私有数据仓 `zxy8125ss/methodology-data`：

```
data/config.json          系统配置
data/domains.json         八大领域
data/methods/<id>.json    单个方法论档案
data/relations.json       知识关联
data/sources.json         资料来源
data/cases.json           真实案例
data/practices.json       实践项目
data/learning.json        学习计划与掌握程度
data/reviews.json         审核记录
research/queue.json       研究任务与待审核候选
research/reports/         研究报告
indexes/                  检索索引
backups/                  定期备份
```

## 快速开始

```bash
npm install
npm run dev          # 前端开发服务器（:5173）
npm run worker:dev   # Worker 本地开发（:8787）
```

## 常用命令

```bash
npm run typecheck    # TypeScript 检查
npm run build        # 生产构建
npm run test         # 单元测试
npm run data:index   # 构建检索索引
npm run data:validate # 校验数据完整性
npm run data:seed    # 写入种子数据
npm run backup       # 备份数据仓
```

## 安全边界

- AI 模型密钥与 GitHub Token **只存在于 Worker 的环境变量**（`wrangler secret put`）
- 前端代码与公开仓库中不存在任何密钥
- 前端只持有一个调用 Worker 的 Bearer Token，保存在浏览器本地
- 私有数据存放在私有仓库，站点仓库不包含任何个人知识内容

## 部署

详见 [docs/部署与维护手册.md](docs/部署与维护手册.md)。

## 文档

- [产品需求与技术说明](docs/产品需求与技术说明.md)
- [部署与维护手册](docs/部署与维护手册.md)
- [数据结构说明](docs/数据结构说明.md)
- [AI 模型与搜索配置](docs/AI模型与搜索配置.md)
- [自动化任务说明](docs/自动化任务说明.md)
- [测试与验收报告](docs/测试与验收报告.md)
- [迭代路线图](docs/迭代路线图.md)
