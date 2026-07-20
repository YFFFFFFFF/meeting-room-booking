# 会议室预约管理系统 — 后端 API

基于 Go + Gin + GORM + PostgreSQL + Redis 构建。

## 技术栈

| 组件 | 技术 |
|------|------|
| 语言 | Go 1.22 |
| Web 框架 | Gin |
| ORM | GORM |
| 数据库 | PostgreSQL 16 |
| 缓存 | Redis 7 |
| 认证 | JWT |
| 容器化 | Docker + Docker Compose |

## 快速开始

### 前置条件

- Go 1.22+
- Docker & Docker Compose

### 本地开发

```bash
# 1. 启动依赖服务
cd backend/docker
docker-compose up -d postgres redis

# 2. 启动后端
cd ..
go run main.go
```

### Docker 一键启动

```bash
cd backend/docker
docker-compose up -d
```

服务启动后访问 http://localhost:8080/health

## API 模块

| 模块 | 路径前缀 | 说明 |
|------|----------|------|
| 认证 | `/api/auth` | 登录/刷新/当前用户 |
| 会议室 | `/api/rooms` | CRUD/列表/可用时段/导入导出 |
| 预约 | `/api/bookings` | 创建/修改/取消/我的预约/签到 |
| 审批 | `/api/approvals` | 待审批/通过/驳回 |
| 设备 | `/api/equipment` | 设备列表/状态更新/报修 |
| 统计 | `/api/stats` | 实时看板/利用率报表 |
| 配置 | `/api/config` | 预约规则/楼层/设备类型 |
| 用户 | `/api/users` | 用户搜索 |
| 企微 | `/cgi-bin` | 企微 API Mock |

## 项目结构

```
backend/
├── cmd/server/     # 服务入口（路由/启动）
├── internal/
│   ├── config/     # 配置
│   ├── handler/    # HTTP 处理器
│   │   ├── auth/       # 认证
│   │   ├── rooms/      # 会议室
│   │   ├── bookings/   # 预约
│   │   ├── approvals/  # 审批
│   │   ├── equipment/  # 设备
│   │   ├── stats/      # 统计
│   │   ├── config/     # 配置
│   │   ├── users/      # 用户
│   │   └── wecom/      # 企微
│   ├── middleware/ # JWT/RBAC/RequestID
│   ├── model/      # 数据模型
│   ├── repository/ # 数据库/缓存
│   └── scheduler/  # 定时任务
├── migrations/     # SQL 迁移
├── docker/         # Docker 配置
└── main.go         # 入口
```
