// admin-portal/src/app/(dashboard)/app/web-content/page.tsx
'use client';

import React from 'react';
import { Result, Button, Card, Typography, Space } from 'antd';
import { GlobalOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Paragraph, Text } = Typography;

/**
 * Web Content Management Page - Placeholder Implementation
 * 
 * This page will be implemented in a future sprint to provide:
 * - Content management for public website
 * - Blog post creation and editing
 * - Event announcements management
 * - Resource library management
 * - SEO optimization tools
 */
export default function WebContentPage() {
  const router = useRouter();

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Result
          icon={<GlobalOutlined style={{ fontSize: '64px', color: '#52c41a' }} />}
          title="Gestión de Contenido Web"
          subTitle={
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary">
                Esta funcionalidad estará disponible próximamente.
              </Text>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                Podrás gestionar el contenido del sitio web público, crear anuncios y administrar recursos.
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
              key="events" 
              onClick={() => router.push('/app/events')}
            >
              Ver Eventos
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
              <Title level={5}>📝 Editor de Contenido</Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Editor WYSIWYG para crear y editar páginas web.
              </Paragraph>
            </div>
            
            <div>
              <Title level={5}>📢 Gestión de Anuncios</Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Crear y programar anuncios para el sitio web.
              </Paragraph>
            </div>
            
            <div>
              <Title level={5}>📚 Biblioteca de Recursos</Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Organizar documentos públicos y recursos descargables.
              </Paragraph>
            </div>
            
            <div>
              <Title level={5}>🔍 SEO y Analytics</Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Herramientas de optimización para motores de búsqueda.
              </Paragraph>
            </div>
          </Space>
        </Card>
      </Card>
    </div>
  );
}
