'use client';

import { Spin, Card, Skeleton } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

export default function DashboardLoading() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Skeleton */}
      <div style={{ marginBottom: '24px' }}>
        <Skeleton.Input active size="large" style={{ width: '300px', marginBottom: '16px' }} />
        <Skeleton.Button active size="large" style={{ width: '200px' }} />
      </div>

      {/* Statistics Cards Skeleton */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} size="small">
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>

      {/* Loading Overlay */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div style={{ textAlign: 'center' }}>
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />}
            size="large"
          />
          <div style={{ marginTop: '16px', color: '#666', fontSize: '16px' }}>
            Cargando panel de control...
          </div>
        </div>
      </div>
    </div>
  );
}
