// ============================================================
// MSW Handlers 聚合入口
// 覆盖所有后端 API + 企微 API Mock
// ============================================================

import { authHandlers } from './auth';
import { userHandlers } from './users';
import { roomHandlers } from './rooms';
import { bookingHandlers } from './bookings';
import { approvalHandlers } from './approvals';
import { equipmentHandlers } from './equipment';
import { statsHandlers } from './stats';
import { configHandlers } from './config';
import { wecomHandlers } from './wecom';

export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...roomHandlers,
  ...bookingHandlers,
  ...approvalHandlers,
  ...equipmentHandlers,
  ...statsHandlers,
  ...configHandlers,
  ...wecomHandlers,
];
