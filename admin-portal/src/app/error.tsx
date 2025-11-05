'use client';

import { useEffect } from 'react';
import { Button, Result, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '20px'
    }}>
      <Result
        status="error"
        title="Ha ocurrido un error"
        subTitle="Lo sentimos, algo salió mal. Por favor, intenta nuevamente."
        icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
        extra={[
          <Button type="primary" key="retry" onClick={reset}>
            Intentar nuevamente
          </Button>
        ]}
      >
        <div className="desc">
          <Paragraph>
            <Text strong style={{ fontSize: '16px' }}>
              Detalles del error:
            </Text>
          </Paragraph>
          <Paragraph>
            <Text type="danger">
              {error?.message || 'Error desconocido'}
            </Text>
          </Paragraph>
          {process.env.NODE_ENV === 'development' && (
            <Paragraph>
              <Text code>
                {error?.stack}
              </Text>
            </Paragraph>
          )}
        </div>
      </Result>
    </div>
  );
}
