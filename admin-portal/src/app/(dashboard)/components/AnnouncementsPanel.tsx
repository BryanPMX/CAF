'use client';

import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Carousel, Image, Typography, Spin, Empty, Button, Tag, Space, Badge } from 'antd';
import { BellOutlined, PushpinOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { apiClient } from '../../lib/api';

interface Announcement {
  id: number;
  title: string;
  bodyHtml: string;
  images?: string[];
  pinned?: boolean;
  createdAt?: string;
  tags?: string[];
}

const AnnouncementsPanel: React.FC = () => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/dashboard/announcements');
        setItems(res.data.announcements || []);
      } catch (error) {
        console.error('Error loading announcements:', error);
        // If announcements fail to load, just show empty state
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const dismiss = async (id: number) => {
    try {
      await apiClient.post(`/dashboard/announcements/${id}/dismiss`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Error dismissing announcement:', error);
    }
  };

  if (loading) return (
    <Card className="mt-6">
      <div className="text-center py-8">
        <Spin size="large" />
        <div className="mt-4 text-gray-500">Cargando anuncios...</div>
      </div>
    </Card>
  );

  if (!items.length) return (
    <Card className="mt-6">
      <Empty 
        description="No hay anuncios disponibles" 
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    </Card>
  );

  // Sort items: pinned first, then by creation date
  const sortedItems = [...items].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <div className="mt-6">
      <div className="flex items-center mb-4">
        <BellOutlined className="text-blue-500 text-xl mr-2" />
        <Typography.Title level={4} className="mb-0">Anuncios del Sistema</Typography.Title>
        <Badge count={items.length} className="ml-2" />
      </div>
      
      <Row gutter={[16, 16]}>
        {sortedItems.map((announcement) => (
          <Col xs={24} md={12} lg={8} key={announcement.id}>
            <Card 
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {announcement.pinned && (
                      <PushpinOutlined className="text-yellow-500 mr-2" />
                    )}
                    <span className="font-medium">{announcement.title}</span>
                  </div>
                  <Button 
                    size="small" 
                    onClick={() => dismiss(announcement.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    Ocultar
                  </Button>
                </div>
              } 
              bordered 
              hoverable 
              className="h-full flex flex-col"
              extra={
                <div className="flex items-center text-xs text-gray-500">
                  <ClockCircleOutlined className="mr-1" />
                  {announcement.createdAt ? new Date(announcement.createdAt).toLocaleDateString() : 'Reciente'}
                </div>
              }
            >
              <div className="flex-1">
                {/* Tags */}
                {announcement.tags && announcement.tags.length > 0 && (
                  <div className="mb-3">
                    <Space wrap>
                      {announcement.tags.map((tag, index) => (
                        <Tag key={index} color="blue">
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}

                {/* Images Carousel */}
                {Array.isArray(announcement.images) && announcement.images.length > 0 && (
                  <div className="mb-3">
                    <Carousel dots className="rounded-lg overflow-hidden">
                      {announcement.images.map((src, idx) => (
                        <div key={idx}>
                          <Image 
                            src={src} 
                            alt={`anuncio-${announcement.id}-${idx}`} 
                            width="100%" 
                            style={{ 
                              maxHeight: 180, 
                              objectFit: 'cover',
                              borderRadius: '8px'
                            }} 
                          />
                        </div>
                      ))}
                    </Carousel>
                  </div>
                )}

                {/* Content */}
                <div 
                  className="text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: announcement.bodyHtml || '' }} 
                />
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default AnnouncementsPanel;


