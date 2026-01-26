/**
 * @license
 * Copyright 2025 CrewBench Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { BehaviorLogEntry } from '@/process/services/behaviorLogService';
import AionModal from '@/renderer/components/base/AionModal';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { Button, Message, Spin, Tabs, Tag, Timeline, Typography } from '@arco-design/web-react';
import { IconDelete, IconHistory, IconRefresh } from '@arco-design/web-react/icon';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BehaviorLogModalProps {
  visible: boolean;
  workspace?: string;
  onCancel: () => void;
}

const BehaviorLogModal: React.FC<BehaviorLogModalProps> = ({ visible, workspace, onCancel }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<BehaviorLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await ipcBridge.behaviorLog.getLogs.invoke({
        workspace,
        limit: 200,
      });
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs:', error);
      Message.error('Failed to load behavior history');
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      await ipcBridge.behaviorLog.clearLogs.invoke({ workspace });
      setLogs([]);
      Message.success('Logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error);
      Message.error('Failed to clear logs');
    }
  };

  useEffect(() => {
    if (visible) {
      void loadLogs();
    }
  }, [visible, workspace]);

  const filteredLogs = logs.filter((log) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'user') return log.actor === 'User';
    if (activeTab === 'agent') return log.actor === 'Agent';
    return true;
  });

  const getActorColor = (actor: string) => {
    switch (actor) {
      case 'User':
        return 'rgb(var(--primary-6))';
      case 'Agent':
        return 'rgb(var(--success-6))';
      case 'System':
        return 'rgb(var(--warning-6))';
      default:
        return 'rgb(var(--text-2))';
    }
  };

  return (
    <AionModal
      visible={visible}
      onCancel={onCancel}
      footer={null}
      size='large'
      title={
        <div className='flex items-center gap-2'>
          <IconHistory />
          {t('behavior.title') || 'Behavior History'}
        </div>
      }
      contentStyle={{ height: '70vh', padding: 0 }}
    >
      <div className='flex flex-col h-full'>
        <div className='flex items-center justify-between px-4 py-2 border-b border-border'>
          <Tabs activeTab={activeTab} onChange={setActiveTab} type='text'>
            <Tabs.TabPane key='all' title={t('behavior.all') || 'All'} />
            <Tabs.TabPane key='user' title={t('behavior.user') || 'User'} />
            <Tabs.TabPane key='agent' title={t('behavior.agent') || 'Agent'} />
          </Tabs>
          <div className='flex gap-2'>
            <Button size='small' icon={<IconRefresh />} onClick={loadLogs} />
            <Button size='small' status='danger' icon={<IconDelete />} onClick={clearLogs} />
          </div>
        </div>

        <AionScrollArea className='flex-1 p-4'>
          <Spin loading={loading} block>
            {filteredLogs.length === 0 ? (
              <div className='flex items-center justify-center h-full text-text-3'>{t('behavior.empty') || 'No history found'}</div>
            ) : (
              <Timeline>
                {filteredLogs.map((log) => (
                  <Timeline.Item
                    key={log.id}
                    dot={
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: getActorColor(log.actor),
                        }}
                      />
                    }
                    label={new Date(log.createdAt).toLocaleString()}
                  >
                    <div className='bg-fill-2 p-3 rounded-lg mb-2'>
                      <div className='flex items-center gap-2 mb-1'>
                        <Tag size='small' color={getActorColor(log.actor)}>
                          {log.actor}
                          {log.agentType ? ` (${log.agentType})` : ''}
                        </Tag>
                        <Typography.Text bold>{log.actionType}</Typography.Text>
                      </div>
                      {log.actionType !== 'response' && <Typography.Text className='text-text-2 block mb-1'>{log.description}</Typography.Text>}
                      {log.metadata && (log.actionType.startsWith('file_') || log.actionType === 'response' || log.actionType === 'command_execution') && <pre className='text-xs bg-fill-3 p-2 rounded overflow-auto mt-2 text-text-3 max-h-32'>{log.actionType === 'response' && typeof log.metadata.fullResponse === 'string' ? log.metadata.fullResponse : JSON.stringify(log.metadata, null, 2)}</pre>}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </Spin>
        </AionScrollArea>
      </div>
    </AionModal>
  );
};

export default BehaviorLogModal;
