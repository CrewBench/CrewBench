/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { uuid } from '@/common/utils';
import { getDatabase } from '@/process/database/export';
import type Database from 'better-sqlite3';
import { createHash } from 'crypto';

/**
 * File timeline entry
 */
export interface FileTimelineEntry {
  id: string;
  filePath: string;
  workspace: string;
  content: string;
  contentHash: string;
  operation: 'create' | 'write' | 'delete';
  agentType?: string;
  conversationId?: string;
  messageId?: string;
  createdAt: number;
}

/**
 * File timeline statistics
 */
export interface FileTimelineStats {
  filePath: string;
  changeCount: number;
  firstChangeAt: number;
  lastChangeAt: number;
  operations: {
    create: number;
    write: number;
    delete: number;
  };
}

/**
 * File diff between two versions
 */
export interface FileDiff {
  fromVersion: FileTimelineEntry | null;
  toVersion: FileTimelineEntry;
  diff: string;
  addedLines: number;
  removedLines: number;
}

class FileTimelineService {
  private getDb(): Database.Database {
    // Access the internal db property using type assertion
    // This is safe because we control both the service and database classes
    const dbInstance = getDatabase() as any;
    return dbInstance.db as Database.Database;
  }

  /**
   * Calculate content hash for deduplication
   */
  private calculateContentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Record a file change in the timeline
   */
  public recordChange(params: {
    filePath: string;
    workspace: string;
    content: string;
    operation: 'create' | 'write' | 'delete';
    agentType?: string;
    conversationId?: string;
    messageId?: string;
  }): FileTimelineEntry {
    const db = this.getDb();
    const contentHash = this.calculateContentHash(params.content);
    const createdAt = Date.now();
    const id = uuid();

    // For delete operations, content should be empty but we still record it
    const content = params.operation === 'delete' ? '' : params.content;

    const stmt = db.prepare(`
      INSERT INTO file_timeline (
        id, file_path, workspace, content, content_hash, operation,
        agent_type, conversation_id, message_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.filePath,
      params.workspace,
      content,
      contentHash,
      params.operation,
      params.agentType || null,
      params.conversationId || null,
      params.messageId || null,
      createdAt
    );

    return {
      id,
      filePath: params.filePath,
      workspace: params.workspace,
      content,
      contentHash,
      operation: params.operation,
      agentType: params.agentType,
      conversationId: params.conversationId,
      messageId: params.messageId,
      createdAt,
    };
  }

  /**
   * Get all timeline entries for a file
   */
  public getFileTimeline(filePath: string, workspace?: string): FileTimelineEntry[] {
    const db = this.getDb();

    let stmt;
    if (workspace) {
      stmt = db.prepare(`
        SELECT * FROM file_timeline
        WHERE file_path = ? AND workspace = ?
        ORDER BY created_at DESC
      `);
    } else {
      stmt = db.prepare(`
        SELECT * FROM file_timeline
        WHERE file_path = ?
        ORDER BY created_at DESC
      `);
    }

    const rows = (workspace ? stmt.all(filePath, workspace) : stmt.all(filePath)) as Array<{
      id: string;
      file_path: string;
      workspace: string;
      content: string;
      content_hash: string;
      operation: string;
      agent_type: string | null;
      conversation_id: string | null;
      message_id: string | null;
      created_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      filePath: row.file_path,
      workspace: row.workspace,
      content: row.content,
      contentHash: row.content_hash,
      operation: row.operation as 'create' | 'write' | 'delete',
      agentType: row.agent_type || undefined,
      conversationId: row.conversation_id || undefined,
      messageId: row.message_id || undefined,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get file timeline statistics
   */
  public getFileStats(filePath: string, workspace?: string): FileTimelineStats | null {
    const timeline = this.getFileTimeline(filePath, workspace);

    if (timeline.length === 0) {
      return null;
    }

    const operations = {
      create: 0,
      write: 0,
      delete: 0,
    };

    timeline.forEach((entry) => {
      operations[entry.operation]++;
    });

    const sortedByTime = [...timeline].sort((a, b) => a.createdAt - b.createdAt);

    return {
      filePath,
      changeCount: timeline.length,
      firstChangeAt: sortedByTime[0]?.createdAt || 0,
      lastChangeAt: sortedByTime[sortedByTime.length - 1]?.createdAt || 0,
      operations,
    };
  }

  /**
   * Get a specific version by ID
   */
  public getVersion(versionId: string): FileTimelineEntry | null {
    const db = this.getDb();

    const row = db
      .prepare(
        `
      SELECT * FROM file_timeline
      WHERE id = ?
    `
      )
      .get(versionId) as {
      id: string;
      file_path: string;
      workspace: string;
      content: string;
      content_hash: string;
      operation: string;
      agent_type: string | null;
      conversation_id: string | null;
      message_id: string | null;
      created_at: number;
    } | null;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      filePath: row.file_path,
      workspace: row.workspace,
      content: row.content,
      contentHash: row.content_hash,
      operation: row.operation as 'create' | 'write' | 'delete',
      agentType: row.agent_type || undefined,
      conversationId: row.conversation_id || undefined,
      messageId: row.message_id || undefined,
      createdAt: row.created_at,
    };
  }

  /**
   * Calculate diff between two versions
   */
  public calculateDiff(fromVersionId: string | null, toVersionId: string): FileDiff | null {
    const toVersion = this.getVersion(toVersionId);
    if (!toVersion) {
      return null;
    }

    const fromVersion = fromVersionId ? this.getVersion(fromVersionId) : null;

    const fromContent = fromVersion?.content || '';
    const toContent = toVersion.content || '';

    const diff = this.computeSimpleDiff(fromContent, toContent);
    const { addedLines, removedLines } = this.countDiffLines(diff);

    return {
      fromVersion,
      toVersion,
      diff,
      addedLines,
      removedLines,
    };
  }

  /**
   * Simple diff computation (line-based)
   */
  private computeSimpleDiff(fromContent: string, toContent: string): string {
    const fromLines = fromContent.split('\n');
    const toLines = toContent.split('\n');

    const diff: string[] = [];
    let i = 0;
    let j = 0;

    while (i < fromLines.length || j < toLines.length) {
      if (i >= fromLines.length) {
        diff.push(`+${toLines[j]}`);
        j++;
      } else if (j >= toLines.length) {
        diff.push(`-${fromLines[i]}`);
        i++;
      } else if (fromLines[i] === toLines[j]) {
        diff.push(` ${fromLines[i]}`);
        i++;
        j++;
      } else {
        // Check if line was moved or changed
        const nextMatch = toLines.indexOf(fromLines[i], j);
        if (nextMatch !== -1 && nextMatch - j < 3) {
          // Line was moved, add intermediate lines as additions
          for (let k = j; k < nextMatch; k++) {
            diff.push(`+${toLines[k]}`);
          }
          diff.push(` ${fromLines[i]}`);
          i++;
          j = nextMatch + 1;
        } else {
          diff.push(`-${fromLines[i]}`);
          diff.push(`+${toLines[j]}`);
          i++;
          j++;
        }
      }
    }

    return diff.join('\n');
  }

  /**
   * Count added and removed lines in diff
   */
  private countDiffLines(diff: string): { addedLines: number; removedLines: number } {
    const lines = diff.split('\n');
    let addedLines = 0;
    let removedLines = 0;

    lines.forEach((line) => {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removedLines++;
      }
    });

    return { addedLines, removedLines };
  }

  /**
   * Delete timeline entries for a file (cleanup)
   */
  public deleteFileTimeline(filePath: string, workspace?: string): void {
    const db = this.getDb();

    if (workspace) {
      const stmt = db.prepare(`
        DELETE FROM file_timeline
        WHERE file_path = ? AND workspace = ?
      `);
      stmt.run(filePath, workspace);
    } else {
      const stmt = db.prepare(`
        DELETE FROM file_timeline
        WHERE file_path = ?
      `);
      stmt.run(filePath);
    }
  }

  /**
   * Get all files that have timeline entries in a workspace
   */
  public getTrackedFiles(workspace: string): string[] {
    const db = this.getDb();

    const rows = db
      .prepare(`
      SELECT DISTINCT file_path FROM file_timeline
      WHERE workspace = ?
      ORDER BY file_path
    `)
      .all(workspace) as Array<{ file_path: string }>;

    return rows.map((row) => row.file_path);
  }
}

// Singleton instance
let timelineServiceInstance: FileTimelineService | null = null;

export function getFileTimelineService(): FileTimelineService {
  if (!timelineServiceInstance) {
    timelineServiceInstance = new FileTimelineService();
  }
  return timelineServiceInstance;
}
