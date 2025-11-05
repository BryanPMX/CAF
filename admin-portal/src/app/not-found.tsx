'use client';

import { Button, Result } from 'antd';
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <Result
      status="404"
      title="Página no encontrada"
      subTitle="La página que estás buscando no existe o ha sido movida."
      extra={[
        <Button
          key="home"
          type="primary"
          icon={<HomeOutlined />}
          onClick={() => router.push('/')}
        >
          Ir al inicio
        </Button>,
        <Button
          key="back"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
        >
          Volver atrás
        </Button>
      ]}
    />
  );
}
