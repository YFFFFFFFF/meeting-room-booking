# T1.5 Mock Server 交付说明

## 概览

基于 **MSW (Mock Service Worker)** 搭建的前端 Mock Server，在企微 API 权限未就绪 + 后端 API 开发完成前，提供完整的 Mock 数据支持，确保前端开发不阻塞。

## 技术方案

- **框架**: React 18 + TypeScript + Vite
- **Mock 工具**: MSW 2.x (Mock Service Worker)
- **拦截方式**: Service Worker 级别拦截，浏览器 DevTools Network 面板可见

## Mock 覆盖范围

### 后端 API (共 26 个端点)

| 模块 | 端点 | 方法 | 状态 |
|------|------|------|:----:|
| 认证 | `/api/auth/login` | POST | ✅ |
| 认证 | `/api/auth/refresh` | POST | ✅ |
| 认证 | `/api/auth/me` | GET | ✅ |
| 用户 | `/api/users/search?q=` | GET | ✅ |
| 会议室 | `/api/rooms` | GET | ✅ |
| 会议室 | `/api/rooms/:id` | GET | ✅ |
| 会议室 | `/api/rooms/:id/availability?date=` | GET | ✅ |
| 会议室 | `/api/rooms` | POST | ✅ |
| 会议室 | `/api/rooms/:id` | PUT | ✅ |
| 会议室 | `/api/rooms/:id` | DELETE | ✅ |
| 会议室 | `/api/rooms/import` | POST | ✅ |
| 会议室 | `/api/rooms/export` | GET | ✅ |
| 预约 | `/api/bookings` | POST | ✅ |
| 预约 | `/api/bookings/:id` | PUT | ✅ |
| 预约 | `/api/bookings/:id` | DELETE | ✅ |
| 预约 | `/api/bookings/mine` | GET | ✅ |
| 预约 | `/api/bookings/:id/checkin` | POST | ✅ |
| 审批 | `/api/approvals/pending` | GET | ✅ |
| 审批 | `/api/approvals/:id/approve` | POST | ✅ |
| 审批 | `/api/approvals/:id/reject` | POST | ✅ |
| 设备 | `/api/equipment?room_id=` | GET | ✅ |
| 设备 | `/api/equipment/:id` | PUT | ✅ |
| 设备 | `/api/repair-tickets` | POST | ✅ |
| 设备 | `/api/repair-tickets/:id` | PUT | ✅ |
| 统计 | `/api/stats/dashboard` | GET | ✅ |
| 统计 | `/api/stats/utilization` | GET | ✅ |
| 统计 | `/api/stats/export` | GET | ✅ |
| 配置 | `/api/config/booking-rules` | GET | ✅ |
| 配置 | `/api/config/booking-rules` | PUT | ✅ |
| 配置 | `/api/config/floors` | GET | ✅ |
| 配置 | `/api/config/equipment-types` | GET | ✅ |

### 企微 API (共 10 个端点)

| 端点 | 说明 | 状态 |
|------|------|:----:|
| `/cgi-bin/gettoken` | 获取 access_token | ✅ |
| `/cgi-bin/user/getuserinfo` | OAuth 获取用户身份 | ✅ |
| `/cgi-bin/user/get` | 获取用户详细信息 | ✅ |
| `/cgi-bin/department/list` | 部门列表 | ✅ |
| `/cgi-bin/user/simplelist` | 部门成员列表 | ✅ |
| `/cgi-bin/message/send` | 发送应用消息 | ✅ |
| `/cgi-bin/message/send_template_card` | 发送模板卡片 | ✅ |
| `/cgi-bin/calendar/calendar/add` | 创建日程 | ✅ |
| `/cgi-bin/calendar/calendar/update` | 更新日程 | ✅ |
| `/cgi-bin/calendar/calendar/delete` | 删除日程 | ✅ |
| `/cgi-bin/get_jsapi_ticket` | JSSDK ticket | ✅ |
| `/cgi-bin/ticket/get` | 应用 ticket | ✅ |

## 种子数据

### 用户 (15人，4种角色)
- super_admin: 木子日立
- admin: 执拗、周八
- it_admin: IT运维
- employee: 张三、李四、王五、赵六、孙七、吴九、郑十、陈一、林二、黄三、刘四

### 会议室 (10间，4个楼层)
| 名称 | 楼层 | 容量 | 类型 | 状态 |
|------|------|------|------|------|
| 3F-长江 | 3F | 6 | small | active |
| 3F-黄河 | 3F | 8 | medium | active |
| 3F-珠江 | 3F | 4 | small | active |
| 5F-泰山 | 5F | 20 | large | active |
| 5F-华山 | 5F | 12 | medium | active |
| 5F-衡山 | 5F | 6 | small | maintenance |
| 8F-报告厅A | 8F | 50 | large | active |
| 8F-报告厅B | 8F | 30 | large | active |
| 10F-云端 | 10F | 10 | medium | active |
| 10F-星空 | 10F | 8 | medium | active |

### 今日预约 (9条，覆盖各状态)
- 已签到 (checked_in): 2条
- 已确认 (confirmed): 5条
- 已取消 (cancelled): 1条
- 已释放 (released): 1条

## 业务逻辑覆盖

- ✅ 冲突检测：同一会议室同时段返回 409 + 替代会议室推荐
- ✅ 大会议室审批：容量 > 20 的会议室预约自动进入待审批
- ✅ 预约取消：会议开始后不可取消
- ✅ 修改预约：修改时间触发重新冲突检测
- ✅ 会议室筛选：关键词/楼层/容量/设备标签组合筛选
- ✅ 可用时段：按日期返回 08:00-20:00 每30分钟可用性
- ✅ 设备状态：available/faulty/repairing 三种状态

## 项目结构

```
frontend/
├── src/
│   ├── mock/
│   │   ├── browser.ts          # MSW Worker 配置
│   │   ├── handlers/
│   │   │   ├── index.ts        # 聚合入口
│   │   │   ├── auth.ts         # 认证模块
│   │   │   ├── users.ts        # 用户搜索
│   │   │   ├── rooms.ts        # 会议室 CRUD
│   │   │   ├── bookings.ts     # 预约核心
│   │   │   ├── approvals.ts    # 审批
│   │   │   ├── equipment.ts    # 设备管理
│   │   │   ├── stats.ts        # 统计报表
│   │   │   ├── config.ts       # 配置规则
│   │   │   └── wecom.ts        # 企微 API
│   │   └── data/
│   │       └── seed.ts         # 种子数据
│   ├── services/
│   │   └── api.ts              # 统一 API 封装
│   ├── types/
│   │   └── index.ts            # TypeScript 类型定义
│   ├── App.tsx                 # Mock Server 验证面板
│   └── main.tsx                # 入口（DEV 环境自动启动 MSW）
└── public/
    └── mockServiceWorker.js    # MSW Service Worker
```

## 启动方式

```bash
cd frontend
npm run dev
```

开发环境自动启动 MSW，浏览器 Console 显示 `[MSW] Mock Server 已启动`。

切换到真实 API：修改 `.env` 中 `VITE_API_BASE_URL` 并注释 `main.tsx` 中的 MSW 初始化即可。

## 交付清单

- [x] TypeScript 类型定义（对齐技术方案数据模型）
- [x] 10 间会议室 + 15 个用户种子数据
- [x] 31 个后端 API Mock Handlers
- [x] 12 个企微 API Mock Handlers
- [x] 冲突检测 + 大会议室审批业务逻辑
- [x] 统一 API 服务层封装
- [x] Mock Server 验证面板
- [x] TypeScript 零错误
- [x] Vite 构建通过
