// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/CaseTimeline.tsx (New File)
'use client';

import React from 'react';
import { Timeline, Tag, Button } from 'antd';
import { CommentOutlined, FilePdfOutlined, PaperClipOutlined } from '@ant-design/icons';

// Define the structures for our timeline events
interface User {
  firstName: string;
  lastName: string;
}

interface CaseEvent {
  id: number;
  eventType: string;
  visibility: string;
  commentText?: string;
  fileName?: string;
  fileUrl?: string;
  createdAt: string;
  user: User;
}

interface CaseTimelineProps {
  events: CaseEvent[];
}

const CaseTimeline: React.FC<CaseTimelineProps> = ({ events }) => {
  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'comment':
        return <CommentOutlined />;
      case 'file_upload':
        return <PaperClipOutlined />;
      default:
        return null;
    }
  };

  return (
    <Timeline>
      {events.map(event => (
        <Timeline.Item key={event.id} dot={getEventIcon(event.eventType)}>
          <div className="flex justify-between">
            <span className="font-semibold">{`${event.user.firstName} ${event.user.lastName}`}</span>
            <span className="text-xs text-gray-500">{new Date(event.createdAt).toLocaleString()}</span>
          </div>
          {event.eventType === 'comment' && (
            <p className="mt-1 bg-gray-50 p-3 rounded-md">{event.commentText}</p>
          )}
          {event.eventType === 'file_upload' && (
            <div className="mt-1 bg-blue-50 p-3 rounded-md border border-blue-200">
              <p className="font-medium">Nuevo documento subido:</p>
              <a href={event.fileUrl} target="_blank" rel="noopener noreferrer">
                <Button icon={<FilePdfOutlined />}>{event.fileName}</Button>
              </a>
            </div>
          )}
          <Tag color={event.visibility === 'client_visible' ? 'green' : 'red'}>
            {event.visibility === 'client_visible' ? 'VISIBLE PARA CLIENTE' : 'INTERNO'}
          </Tag>
        </Timeline.Item>
      ))}
    </Timeline>
  );
};

export default CaseTimeline;