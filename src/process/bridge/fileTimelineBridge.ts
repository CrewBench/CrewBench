/**
 * @license
 * Copyright 2025 CrewBench Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getFileTimelineService } from '@/process/services/fileTimelineService';
import fs from 'fs/promises';
import path from 'path';

export function initFileTimelineBridge(): void {
  const timelineService = getFileTimelineService();

  // Get file timeline entries
  ipcBridge.fileTimeline.getFileTimeline.provider(({ filePath, workspace }) => {
    try {
      const timeline = timelineService.getFileTimeline(filePath, workspace);
      return Promise.resolve(timeline);
    } catch (error) {
      console.error('[FileTimelineBridge] Error getting file timeline:', error);
      return Promise.resolve([]);
    }
  });

  // Get file statistics
  ipcBridge.fileTimeline.getFileStats.provider(({ filePath, workspace }) => {
    try {
      const stats = timelineService.getFileStats(filePath, workspace);
      return Promise.resolve(stats);
    } catch (error) {
      console.error('[FileTimelineBridge] Error getting file stats:', error);
      return Promise.resolve(null);
    }
  });

  // Get specific version
  ipcBridge.fileTimeline.getVersion.provider(({ versionId }) => {
    try {
      const version = timelineService.getVersion(versionId);
      return Promise.resolve(version);
    } catch (error) {
      console.error('[FileTimelineBridge] Error getting version:', error);
      return Promise.resolve(null);
    }
  });

  // Calculate diff between versions
  ipcBridge.fileTimeline.calculateDiff.provider(({ fromVersionId, toVersionId }) => {
    try {
      const diff = timelineService.calculateDiff(fromVersionId, toVersionId);
      return Promise.resolve(diff);
    } catch (error) {
      console.error('[FileTimelineBridge] Error calculating diff:', error);
      return Promise.resolve(null);
    }
  });

  // Revert file to a specific version
  ipcBridge.fileTimeline.revertToVersion.provider(async ({ versionId }) => {
    try {
      const version = timelineService.getVersion(versionId);
      if (!version) {
        return { success: false, msg: 'Version not found' };
      }

      if (version.operation === 'delete') {
        // If the version is a delete, we can't revert to it - the file doesn't exist
        return { success: false, msg: 'Cannot revert to a deleted version' };
      }

      // Write the version content back to the file
      await fs.writeFile(version.filePath, version.content, 'utf-8');

      // Record the revert as a new change
      timelineService.recordChange({
        filePath: version.filePath,
        workspace: version.workspace,
        content: version.content,
        operation: 'write',
        agentType: 'user',
        conversationId: version.conversationId,
      });

      // Emit file stream update so preview panel refreshes automatically
      try {
        const { ipcBridge } = await import('@/common');
        const pathSegments = version.filePath.split(path.sep);
        const fileName = pathSegments[pathSegments.length - 1];
        
        ipcBridge.fileStream.contentUpdate.emit({
          filePath: version.filePath,
          content: version.content,
          workspace: version.workspace,
          relativePath: fileName,
          operation: 'write',
        });
      } catch (emitError) {
        console.error('[FileTimelineBridge] Failed to emit file stream update after revert:', emitError);
      }

      return { success: true };
    } catch (error) {
      console.error('[FileTimelineBridge] Error reverting to version:', error);
      return {
        success: false,
        msg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get all tracked files in a workspace
  ipcBridge.fileTimeline.getTrackedFiles.provider(({ workspace }) => {
    try {
      const files = timelineService.getTrackedFiles(workspace);
      return Promise.resolve(files);
    } catch (error) {
      console.error('[FileTimelineBridge] Error getting tracked files:', error);
      return Promise.resolve([]);
    }
  });
}
