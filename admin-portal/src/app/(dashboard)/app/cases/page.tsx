// admin-portal/src/app/(dashboard)/app/cases/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Table, message, Spin, Tag, Button } from 'antd';
import { PlusOutlined, EyeOutlined } from '@ant-design/icons';
import { apiClient } from '../../../lib/api';
import CreateCaseModal from './components/CreateCaseModal';

// --- TypeScript Interfaces ---
interface Client {
  firstName: string;
  lastName: string;
}

interface Office {
  name: string;
}

interface Case {
  id: number;
  title: string;
  status: string;
  client: Client;
  office: Office;
  createdAt: string;
}

const CaseManagementPage = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/cases');
      setCases(response.data);
    } catch (error) {
      message.error('No se pudieron cargar los casos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const columns = [
    { title: 'Título del Caso', dataIndex: 'title', key: 'title' },
    {
      title: 'Cliente',
      dataIndex: ['client', 'firstName'],
      key: 'client',
      render: (_: any, record: Case) => `${record.client.firstName} ${record.client.lastName}`,
    },
    { title: 'Oficina', dataIndex: ['office', 'name'], key: 'office' },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'blue';
        if (status === 'closed') color = 'green';
        if (status === 'on_hold') color = 'orange';
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Fecha de Creación',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Acciones',
      key: 'actions',
      // --- THIS IS THE FIX ---
      // The Link component's href now points to the correct, restructured URL: /app/cases/[id]
      render: (_: any, record: Case) => (
        <Link href={`/app/cases/${record.id}`}>
          <Button icon={<EyeOutlined />}>Ver Detalles</Button>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Casos</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalVisible(true)}
        >
          Crear Caso
        </Button>
      </div>
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={cases}
          rowKey="id"
          locale={{ emptyText: 'No hay casos para mostrar. ¡Crea el primero!' }}
        />
      </Spin>
      <CreateCaseModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={fetchCases}
      />
    </div>
  );
};

export default CaseManagementPage;




