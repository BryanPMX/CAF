// admin-portal/src/app/(dashboard)/app/files/page.tsx
'use client';

import React from 'react';
import { Result, Button, Card, Typography, Space } from 'antd';
import { FileOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Paragraph, Text } = Typography;

/**
 * Files Management Page - Placeholder Implementation
 * 
 * This page will be implemented in a future sprint to provide:
 * - Document upload and management
 * - File organization by categories
 * - Version control for documents
 * - Access permissions based on user roles
 * - Integration with case management system
 */
export default function FilesPage() {
  const router = useRouter();

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Result
          icon={<FileOutlined style={{ fontSize: '64px', color: '#1890ff' }} />}
          title="Gestión de Archivos"
          subTitle={
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary">
                Esta funcionalidad estará disponible próximamente.
              </Text>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Podrás gestionar documentos, organizar archivos por categorías y controlar el acceso basado en roles.
              </Text>
            </Space>
          }
          extra={[
            <Button 
              key="dashboard" 
              type="primary" 
              onClick={() => router.push('/')}
              style={{ marginRight: '8px' }}
            >
              Volver al Tablero
            </Button>,
            <Button 
              key="cases" 
              onClick={() => router.push('/app/cases')}
            >
              Ver Casos
            </Button>,
          ]}
        />

        {/* Feature Preview */}
        <Card 
          size="small" 
          title="Funcionalidades Planificadas" 
          style={{ marginTop: '24px' }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Title level={5}>📁 Organización de Documentos</Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Clasificación automática por tipo de caso, cliente y fecha.
              </Paragraph>
            </div>
            
            <div>
              <Title level={5}>🔒 Control de Acceso</Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Permisos granulares basados en roles de usuario.
              </Paragraph>
            </div>
            
            <div>
              <Title level={5}>📤 Carga Masiva</Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Subida de múltiples archivos con procesamiento automático.
              </Paragraph>
            </div>
            
            <div>
              <Title level={5}>🔍 Búsqueda Avanzada</Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Búsqueda por contenido, metadatos y etiquetas.
              </Paragraph>
            </div>
          </Space>
        </Card>
      </Card>
    </div>
  );
}
