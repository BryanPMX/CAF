'use client';

import { useEffect } from 'react';
import { Button, Result, Typography, Space } from 'antd';
import { ExclamationCircleOutlined, HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Paragraph, Text } = Typography;

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard error:', error);
  }, [error]);

  const handleGoHome = () => {
    router.push('/app');
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '70vh',
      padding: '20px'
    }}>
      <Result
        status="error"
        title="Error en el Panel de Control"
        subTitle="Ha ocurrido un error al cargar el panel de administración."
        icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={reset}>
              Recargar página
            </Button>
            <Button type="primary" icon={<HomeOutlined />} onClick={handleGoHome}>
              Ir al inicio
            </Button>
          </Space>
        }
      >
        <div className="desc">
          <Paragraph>
            <Text strong style={{ fontSize: '16px' }}>
              Detalles técnicos:
            </Text>
          </Paragraph>
          <Paragraph>
            <Text type="danger">
              {error?.message || 'Error desconocido en el panel de control'}
            </Text>
          </Paragraph>
          {process.env.NODE_ENV === 'development' && error?.stack && (
            <details>
              <summary>Stack trace (desarrollo)</summary>
              <pre style={{
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '200px',
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '4px',
                marginTop: '10px'
              }}>
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </Result>
    </div>
  );
}
