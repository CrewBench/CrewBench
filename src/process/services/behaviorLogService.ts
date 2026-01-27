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

  // ✅ ONLY responsibility: if fullResponse === '' → add tool/command line
  private fillEmptyFullResponse(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!metadata) return metadata;
    if (metadata.fullResponse !== '') return metadata;

    return {
      ...metadata,
      fullResponse: `CommandTool used`,
    };
  }

  public log(params: { id?: string; workspace?: string; actor: 'User' | 'Agent' | 'System'; agentType?: string; actionType: string; description: string; metadata?: Record<string, unknown> }): BehaviorLogEntry {
    console.log('[BehaviorLogService] Logging:', params);
    const db = this.getDb();

    const id = params.id || uuid();
    const createdAt = Date.now();

    const enrichedMetadata = this.fillEmptyFullResponse(params.metadata);
    const metadataStr = enrichedMetadata ? JSON.stringify(enrichedMetadata) : null;

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
      metadata: enrichedMetadata,
      createdAt,
    };
  }

  public updateLog(id: string, params: Partial<Exclude<BehaviorLogEntry, 'id' | 'createdAt'>>): void {
    console.log('[BehaviorLogService] Updating log:', { id, params });
    const db = this.getDb();

    const updates: string[] = [];
    const values: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (params.workspace !== undefined) {
      updates.push('workspace = ?');
      values.push(params.workspace || null);
    }
    if (params.actor !== undefined) {
      updates.push('actor = ?');
      values.push(params.actor);
    }
    if (params.agentType !== undefined) {
      updates.push('agent_type = ?');
      values.push(params.agentType || null);
    }
    if (params.actionType !== undefined) {
      updates.push('action_type = ?');
      values.push(params.actionType);
    }
    if (params.description !== undefined) {
      updates.push('description = ?');
      values.push(params.description);
    }
    if (params.metadata !== undefined) {
      const enrichedMetadata = this.fillEmptyFullResponse(params.metadata);
      updates.push('metadata = ?');
      values.push(enrichedMetadata ? JSON.stringify(enrichedMetadata) : null);
    }

    if (updates.length === 0) return;

    values.push(id);
    const sql = `UPDATE behavior_logs SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);
  }

  public getLogs(workspace?: string, limit = 100): BehaviorLogEntry[] {
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
