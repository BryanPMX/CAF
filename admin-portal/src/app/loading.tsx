import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      flexDirection: 'column',
      gap: '16px'
    }}>
      <Spin
        indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
        size="large"
      />
      <div style={{ color: '#666', fontSize: '16px' }}>
        Cargando aplicación...
      </div>
    </div>
  );
}
