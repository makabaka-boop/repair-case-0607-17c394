# 隧道电缆绕孔预检器

隧道电缆折线绕开钻孔作业面时，即使折线本身没有穿过孔位，**电缆半径仍可能侵入安全圈**；
而“相切”边界最容易产生分歧。本工具对每条闭线段做统一的二维检测：

1. 对每条**闭线段**（含两个端点），求孔圆心到该线段的**唯一最近点**及距离；
   - 垂足在线段内部 → 垂足；垂足落在段外 → 裁剪到较近端点。
2. 扩张半径 = **禁入圈半径 + 电缆半径**。
3. 当 `距离 ≤ 扩张半径` 即判碰撞——**相切（恰好相等）也判碰撞**，避免边界争议；
   最近点统一作为「判定位置」；端点碰撞或整段位于圈内时规则完全相同。
4. 多处碰撞按 **(线段下标, 禁入圈输入顺序)** 升序返回，首个为突出展示项。
5. 计算全程使用 IEEE-754 双精度；响应中的展示坐标/距离四舍五入至三位小数。

## 技术栈

- 后端：Python 3.12 + FastAPI + Pydantic v2（`api/`）
- 前端：TypeScript + React 18 + Vite（`web/`），SVG 绘制路径、禁入圈与判定位置
- 测试：pytest（穿越/端点/相切/圈内线段/排序/字段错误）、Vitest + Testing Library
  （录入校验、**真实 HTTP 请求**、首个碰撞高亮与旧结论清除）

## 目录

```
api/                       FastAPI 服务
  app/geometry.py          自实现二维：最近点 + 碰撞检测（双精度）
  app/schemas.py           Pydantic 模型与字段级校验
  app/main.py              /api/precheck、/api/health、422 字段错误
  tests/                   pytest（穿越/端点/相切/圈内段/排序/错误）
web/                       React + Vite
  src/lib/validation.ts    前端同构校验（字段键与后端一致）
  src/components/Scene.tsx SVG 场景（路径/禁入圈/扩张圈/判定位置）
  src/test/App.real.test.tsx  对真实运行 API 的 Vitest 验收
Dockerfile.verify          验收镜像（Python 3.12 + Node 20）
docker-compose.yml         web / api / verify（一次性）
scripts/verify.sh          验收编排
```

## 一键启动

```bash
docker compose up --build
# Web:  http://localhost:${WEB_PORT:-8080}
# API:  http://localhost:${API_PORT:-8000}/api/health
```

覆盖宿主端口：

```bash
WEB_PORT=9090 API_PORT=9000 docker compose up --build
# 或复制 .env.example 为 .env 后修改
```

## 一次性验收

```bash
docker compose build api verify
docker compose --profile verify run --rm verify
```

`verify` 服务会：等待 API 健康 → 运行后端 pytest → 用 Vitest 对 Compose 中
**真实运行的 API** 发起请求并核对渲染/高亮 → 执行前端生产构建；全部成功退出码为 0。

## 本地开发（无 Docker）

```bash
# 后端（容器固定 3.12；3.11 亦可运行测试）
pip install -r api/requirements-dev.txt
cd api && PYTHONPATH=. uvicorn app.main:app --reload

# 前端（Vite 已配置 /api 代理到 localhost:8000）
cd web && npm install && npm run dev
npm test                                            # Vitest（需先启动 API）
VITE_API_BASE=http://127.0.0.1:8000 npm test
```

## 接口

`POST /api/precheck`

```json
{
  "nodes": [{"x": -100, "y": 0}, {"x": 100, "y": 0}],
  "cable_radius": 5,
  "circles": [{"x": 0, "y": 15, "radius": 10}]
}
```

- 路径节点与圆心坐标为**整数毫米**；电缆/禁入圈半径为**正数**。
- 上例圆心距折线 15mm，扩张半径 = 10 + 5 = 15，属**相切 → 碰撞**，
  判定位置（最近点）为 `(0, 0)`。
- 合法且无碰撞返回 `feasible: true`，页面显示「✅ 可敷设」。

响应（碰撞时）：

```json
{
  "feasible": false,
  "collision_count": 1,
  "first_collision": {
    "segment_index": 0, "circle_index": 0,
    "nearest": {"x": 0.0, "y": 0.0},
    "distance": 15.0, "expanded_radius": 15.0
  },
  "collisions": [ ]
}
```

### 字段级错误（HTTP 422）

非有限数值（NaN/Infinity 或其字符串形式）、节点不足 2 个、非正半径、相邻重复节点、
非整数毫米坐标、布尔值、多余字段等，均返回字段级错误且**不产生任何预检结论**；
前端会清除旧结论并标红对应字段：

```json
{ "ok": false, "errors": { "nodes[1].x": "必须是有限数值（不能是 NaN 或无穷）" } }
```
