/**
 * @license
 * Copyright 2025 CrewBench Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { uuid } from '@/common/utils';
import { getDatabase } from '@/process/database/export';
import type Database from 'better-sqlite3';

export interface BehaviorLogEntry {
  id: string;
  workspace?: string;
  actor: 'User' | 'Agent' | 'System';
  agentType?: string;
  actionType: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

class BehaviorLogService {
  private getDb(): Database.Database {
    const dbInstance = getDatabase() as unknown as { db: Database.Database };
    return dbInstance.db;
  }

  public log(params: { workspace?: string; actor: 'User' | 'Agent' | 'System'; agentType?: string; actionType: string; description: string; metadata?: Record<string, unknown> }): BehaviorLogEntry {
    console.log('[BehaviorLogService] Logging:', params);
    const db = this.getDb();
    const id = uuid();
    const createdAt = Date.now();
    const metadataStr = params.metadata ? JSON.stringify(params.metadata) : null;

    const stmt = db.prepare(`
      INSERT INTO behavior_logs (
        id, workspace, actor, agent_type, action_type, description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, params.workspace || null, params.actor, params.agentType || null, params.actionType, params.description, metadataStr, createdAt);

    return {
      id,
      workspace: params.workspace,
      actor: params.actor,
      agentType: params.agentType,
      actionType: params.actionType,
      description: params.description,
      metadata: params.metadata,
      createdAt,
    };
  }

  public getLogs(workspace?: string, limit = 100): BehaviorLogEntry[] {
    console.log('[BehaviorLogService] getLogs called with:', { workspace, limit });
    const db = this.getDb();
    let stmt;

    if (workspace) {
      stmt = db.prepare(`
        SELECT * FROM behavior_logs
        WHERE workspace = ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      stmt = stmt.bind(workspace, limit);
    } else {
      stmt = db.prepare(`
        SELECT * FROM behavior_logs
        ORDER BY created_at DESC
        LIMIT ?
      `);
      stmt = stmt.bind(limit);
    }

    const rows = stmt.all() as Array<{
      id: string;
      workspace: string | null;
      actor: string;
      agent_type: string | null;
      action_type: string;
      description: string;
      metadata: string | null;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      workspace: row.workspace || undefined,
      actor: row.actor as 'User' | 'Agent' | 'System',
      agentType: row.agent_type || undefined,
      actionType: row.action_type,
      description: row.description,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    }));
  }

  public clearLogs(workspace?: string): void {
    const db = this.getDb();
    if (workspace) {
      db.prepare('DELETE FROM behavior_logs WHERE workspace = ?').run(workspace);
    } else {
      db.prepare('DELETE FROM behavior_logs').run();
    }
  }
}

// Singleton instance
let behaviorLogServiceInstance: BehaviorLogService | null = null;

export function getBehaviorLogService(): BehaviorLogService {
  if (!behaviorLogServiceInstance) {
    behaviorLogServiceInstance = new BehaviorLogService();
  }
  return behaviorLogServiceInstance;
}
