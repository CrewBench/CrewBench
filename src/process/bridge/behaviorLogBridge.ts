/**
 * @license
 * Copyright 2025 CrewBench Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getBehaviorLogService } from '@/process/services/behaviorLogService';

export function initBehaviorLogBridge(): void {
  const behaviorLogService = getBehaviorLogService();

  // Get logs
  ipcBridge.behaviorLog.getLogs.provider(({ workspace, limit }) => {
    console.log('[behaviorLogBridge] getLogs called with:', { workspace, limit });
    try {
      const logs = behaviorLogService.getLogs(workspace, limit);
      console.log('[behaviorLogBridge] getLogs returned:', logs.length, 'logs');
      return Promise.resolve(logs);
    } catch (error) {
      console.error('[behaviorLogBridge] Error getting behavior logs:', error);
      return Promise.resolve([]);
    }
  });

  // Clear logs
  ipcBridge.behaviorLog.clearLogs.provider(({ workspace }) => {
    try {
      behaviorLogService.clearLogs(workspace);
      return Promise.resolve({ success: true });
    } catch (error) {
      console.error('Error clearing behavior logs:', error);
      return Promise.resolve({ success: false, msg: error instanceof Error ? error.message : String(error) });
    }
  });
}
