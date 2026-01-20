/**
 * @license
 * Copyright 2025 CrewBench Authors
 * SPDX-License-Identifier: Apache-2.0
 */


import { ipcBridge } from '@/common';
import type { FileDiff, FileTimelineEntry, FileTimelineStats } from '@/process/services/fileTimelineService';
import AionModal from '@/renderer/components/base/AionModal';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { Button, Message, Spin, Timeline, Typography } from '@arco-design/web-react';
import { Refresh, Undo } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface FileTimelineModalProps {
  visible: boolean;
  filePath: string;
  workspace?: string;
  onCancel: () => void;
}

const FileTimelineModal: React.FC<FileTimelineModalProps> = ({ visible, filePath, workspace, onCancel }) => {
  const { t } = useTranslation();
  const [timeline, setTimeline] = useState<FileTimelineEntry[]>([]);
  const [stats, setStats] = useState<FileTimelineStats | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [diff, setDiff] = useState<FileDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState(false);

  // Load timeline data
  useEffect(() => {
    if (visible && filePath) {
      loadTimeline();
    }
  }, [visible, filePath, workspace]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const [timelineData, statsData] = await Promise.all([
        ipcBridge.fileTimeline.getFileTimeline.invoke({ filePath, workspace }),
        ipcBridge.fileTimeline.getFileStats.invoke({ filePath, workspace }),
      ]);

      setTimeline(timelineData);
      setStats(statsData);

      // Select the first version if available
      if (timelineData.length > 0 && !selectedVersion) {
        setSelectedVersion(timelineData[0].id);
      }
    } catch (error) {
      console.error('[FileTimelineModal] Error loading timeline:', error);
      Message.error(t('timeline.error.loadFailed') || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  // Load diff when version is selected
  useEffect(() => {
    if (selectedVersion && timeline.length > 0) {
      loadDiff();
    }
  }, [selectedVersion, timeline]);

  const loadDiff = async () => {
    if (!selectedVersion) return;

    const currentIndex = timeline.findIndex((v) => v.id === selectedVersion);
    if (currentIndex === -1) return;

    const fromVersionId = currentIndex < timeline.length - 1 ? timeline[currentIndex + 1].id : null;

    try {
      const diffData = await ipcBridge.fileTimeline.calculateDiff.invoke({
        fromVersionId,
        toVersionId: selectedVersion,
      });
      setDiff(diffData);
    } catch (error) {
      console.error('[FileTimelineModal] Error loading diff:', error);
      setDiff(null);
    }
  };

  const handleRevert = async () => {
    if (!selectedVersion) return;

    setReverting(true);
    try {
      const result = await ipcBridge.fileTimeline.revertToVersion.invoke({ versionId: selectedVersion });

      if (result.success) {
        Message.success(t('timeline.success.reverted') || 'File reverted successfully');
        // Reload timeline to include the new revert entry
        await loadTimeline();
        // The fileStream.contentUpdate event will automatically refresh the preview panel
      } else {
        Message.error(result.msg || t('timeline.error.revertFailed') || 'Failed to revert file');
      }
    } catch (error) {
      console.error('[FileTimelineModal] Error reverting:', error);
      Message.error(t('timeline.error.revertFailed') || 'Failed to revert file');
    } finally {
      setReverting(false);
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getOperationIcon = (operation: string) => {
    // Return empty string - no icons needed
    return '';
  };

  const getOperationColor = (operation: string): string => {
    switch (operation) {
      case 'create':
        return 'rgb(var(--success-6))';
      case 'write':
        return 'rgb(var(--primary-6))';
      case 'delete':
        return 'rgb(var(--danger-6))';
      default:
        return 'rgb(var(--text-2))';
    }
  };

  return (
    <AionModal
      visible={visible}
      onCancel={onCancel}
      size='large'
      header={
        <div className='flex items-center justify-between w-full'>
          <div className='flex items-center gap-8px' style={{ alignItems: 'center' }}>

            <Typography.Title heading={5} className='m-0' style={{ lineHeight: '1.5', margin: 0 }}>
              {t('timeline.title') || 'File Timeline'}
            </Typography.Title>
            {stats && (
              <Typography.Text className='text-14px text-t-secondary' style={{ lineHeight: '1.5' }}>
                ({stats.changeCount} {t('timeline.changes') || 'changes'})
              </Typography.Text>
            )}
          </div>
          <Button size='small' icon={<Refresh />} onClick={loadTimeline} loading={loading}>
            
          </Button>
        </div>
      }
    >
      <div className='flex flex-col h-full'>
        {/* File Info */}
        <div className='px-16px py-12px border-b border-b-base mb-16px'>
          <Typography.Text className='text-14px font-500 text-t-primary break-all'>{filePath}</Typography.Text>
          {stats && (
            <div className='flex gap-16px mt-8px'>
              <Typography.Text className='text-12px text-t-secondary'>
                {t('timeline.firstChange') || 'First change'}: {formatDate(stats.firstChangeAt)}
              </Typography.Text>
              <Typography.Text className='text-12px text-t-secondary'>
                {t('timeline.lastChange') || 'Last change'}: {formatDate(stats.lastChangeAt)}
              </Typography.Text>
            </div>
          )}
        </div>

        <div className='flex-1 min-h-0 flex gap-16px'>
          {/* Timeline List */}
          <div className='w-300px flex-shrink-0 border-r border-r-base'>
            <AionScrollArea className='h-full'>
              <Spin loading={loading}>
                {timeline.length === 0 ? (
                  <div className='p-16px text-center text-t-secondary'>
                    {t('timeline.noChanges') || 'No changes tracked for this file'}
                  </div>
                ) : (
                  <Timeline className='p-16px'>
                    {timeline.map((entry, index) => (
                      <Timeline.Item
                        key={entry.id}
                        dot={
                          <div
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: selectedVersion === entry.id ? getOperationColor(entry.operation) : 'rgb(var(--text-4))',
                              border: selectedVersion === entry.id ? `2px solid ${getOperationColor(entry.operation)}` : '2px solid transparent',
                            }}
                          />
                        }
                      >
                        <div
                          className={`cursor-pointer p-8px rd-6px transition-colors ${selectedVersion === entry.id ? 'bg-fill-2' : 'hover:bg-fill-1'}`}
                          onClick={() => setSelectedVersion(entry.id)}
                        >
                          <div className='flex items-center gap-4px mb-4px'>
                            <Typography.Text className='text-12px font-500 text-t-primary'>
                              {t(`timeline.operation.${entry.operation}`) || entry.operation}
                            </Typography.Text>
                            {entry.agentType && (
                              <Typography.Text className='text-11px text-t-secondary ml-auto'>
                                {entry.agentType}
                              </Typography.Text>
                            )}
                          </div>
                          <Typography.Text className='text-11px text-t-secondary'>{formatDate(entry.createdAt)}</Typography.Text>
                        </div>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                )}
              </Spin>
            </AionScrollArea>
          </div>

          {/* Diff View */}
          <div className='flex-1 min-w-0 flex flex-col'>
            {selectedVersion && diff ? (
              <>
                <div className='flex items-center justify-between mb-12px'>
                  <Typography.Text className='text-14px font-500 text-t-primary'>
                    {t('timeline.diff') || 'Changes in this version'}
                  </Typography.Text>
                  <Button
                    type='primary'
                    size='small'
                    icon={<Undo />}
                    onClick={handleRevert}
                    loading={reverting}
                    disabled={!selectedVersion || diff.toVersion.operation === 'delete'}
                  >
                    {t('timeline.revert') || 'Revert to this version'}
                  </Button>
                </div>

                <AionScrollArea className='flex-1 min-h-0'>
                  <div className='p-16px bg-fill-0 rd-8px'>
                    {diff.addedLines > 0 || diff.removedLines > 0 ? (
                      <div className='mb-12px'>
                        <Typography.Text className='text-12px text-t-secondary'>
                          {t('timeline.linesAdded') || 'Lines added'}: <span style={{ color: 'rgb(var(--success-6))' }}>+{diff.addedLines}</span> |{' '}
                          {t('timeline.linesRemoved') || 'Lines removed'}: <span style={{ color: 'rgb(var(--danger-6))' }}>-{diff.removedLines}</span>
                        </Typography.Text>
                      </div>
                    ) : (
                      <div className='mb-12px'>
                        <Typography.Text className='text-12px text-t-secondary'>
                          {t('timeline.noChanges') || 'No changes'} ({t('timeline.operation.create') || 'create'})
                        </Typography.Text>
                      </div>
                    )}

                    <pre
                      className='text-13px font-mono overflow-x-auto'
                      style={{
                        background: 'var(--bg-1)',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid var(--bg-3)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {diff.diff.split('\n').map((line, index) => (
                        <div
                          key={index}
                          style={{
                            color: line.startsWith('+') ? 'rgb(var(--success-6))' : line.startsWith('-') ? 'rgb(var(--danger-6))' : 'var(--text-1)',
                            backgroundColor: line.startsWith('+')
                              ? 'rgba(var(--success-6-rgb), 0.1)'
                              : line.startsWith('-')
                                ? 'rgba(var(--danger-6-rgb), 0.1)'
                                : 'transparent',
                            padding: '2px 4px',
                            margin: '1px 0',
                          }}
                        >
                          {line}
                        </div>
                      ))}
                    </pre>
                  </div>
                </AionScrollArea>
              </>
            ) : (
              <div className='flex-1 flex items-center justify-center text-t-secondary'>
                {t('timeline.selectVersion') || 'Select a version to view changes'}
              </div>
            )}
          </div>
        </div>
      </div>
    </AionModal>
  );
};

export default FileTimelineModal;
