// admin-portal/src/app/(dashboard)/admin/users/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button, Table, message, Spin, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '../../../lib/api';
import UserModal from './components/UserModal'; // Import our reusable modal

// Define the TypeScript interface for a User object to ensure type safety.
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  office?: { name: string }; // The office is optional, as clients won't have one.
}

const UserManagementPage = () => {
  // --- State Management ---
  // `users`: An array to hold the list of users fetched from the API.
  const [users, setUsers] = useState<User[]>([]);
  // `loading`: A boolean to control the visibility of the loading spinner.
  const [loading, setLoading] = useState(true);
  // `isModalVisible`: A boolean to control whether the create/edit modal is open or closed.
  const [isModalVisible, setIsModalVisible] = useState(false);
  // `editingUser`: Holds the data of the user being edited. If it's null, the modal is in "create" mode.
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // --- Data Fetching ---
  // This function fetches the list of all users from our secure admin API endpoint.
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/users');
      setUsers(response.data);
    } catch (error) {
      message.error('No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  };

  // The `useEffect` hook runs this function once when the component is first mounted.
  useEffect(() => {
    fetchUsers();
  }, []); // The empty dependency array `[]` ensures it only runs once.

  // --- Event Handlers ---
  // Opens the modal in "create" mode by ensuring `editingUser` is null.
  const handleCreate = () => {
    setEditingUser(null);
    setIsModalVisible(true);
  };

  // Opens the modal in "edit" mode by passing the selected user's data.
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsModalVisible(true);
  };

  // Handles the user deletion after the admin confirms in the pop-up.
  const handleDelete = async (userId: number) => {
    try {
      message.loading({ content: 'Eliminando...', key: 'deleteUser' });
      await apiClient.delete(`/admin/users/${userId}`);
      message.success({ content: 'Usuario eliminado exitosamente.', key: 'deleteUser' });
      fetchUsers(); // Refresh the user list to reflect the deletion.
    } catch (error) {
      message.error({ content: 'No se pudo eliminar el usuario.', key: 'deleteUser' });
    }
  };

  // --- Table Configuration ---
  // Defines the columns for the Ant Design table.
  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (_: any, record: User) => `${record.firstName} ${record.lastName}`,
    },
    {
      title: 'Correo Electrónico',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag color="blue">{role.toUpperCase()}</Tag>,
    },
    {
      title: 'Oficina',
      dataIndex: ['office', 'name'], // Ant Design can access nested data with an array.
      key: 'office',
      render: (name: string) => name || 'N/A', // Display 'N/A' if no office is assigned.
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: User) => (
        <span className="space-x-2">
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="¿Está seguro de que desea eliminar este usuario?"
            onConfirm={() => handleDelete(record.id)}
            okText="Sí"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Crear Usuario
        </Button>
      </div>
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
        />
      </Spin>
      <UserModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSuccess={fetchUsers} // Pass the fetchUsers function as a callback
        user={editingUser}
      />
    </div>
  );
};

export default UserManagementPage;

