// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Descriptions, Card, Table, Tag, Spin, message, Button, Empty, Row, Col, Tabs, Popconfirm } from 'antd';
import type { TabsProps } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiClient } from '../../../../lib/api';
import CaseTimeline from './components/CaseTimeline';
import AddCommentForm from './components/AddCommentForm';
import UploadDocument from './components/UploadDocument';
import TaskModal from './components/TaskModal';
import CaseProgressTracker from './components/CaseProgressTracker';
import EditStageModal from './components/EditStageModal';

// --- Define the detailed data structures (TypeScript interfaces) for this page ---
interface User {
  id: number;
  firstName: string;
  lastName: string;
}

interface Task {
  id: number;
  title: string;
  status: string;
  assignedTo: User;
  assignedToId: number;
  dueDate: string | null;
}

interface CaseEvent {
  id: number;
  eventType: string;
  visibility: string;
  commentText?: string;
  fileName?: string;
  fileUrl?: string;
  createdAt: string;
  user: User;
}

interface CaseDetails {
  id: number;
  title: string;
  status: string;
  currentStage: string;
  client: User;
  office: { name: string };
  appointments?: any[];
  tasks?: Task[];
  caseEvents?: CaseEvent[];
}

// Define the stages and their Spanish labels, matching the backend configuration.
const ALL_STAGES = ["intake", "initial_consultation", "document_review", "action_plan", "resolution", "closed"];
const STAGE_LABELS: { [key: string]: string } = {
  "intake": "Recepción",
  "initial_consultation": "Consulta Inicial",
  "document_review": "Revisión de Documentos",
  "action_plan": "Plan de Acción",
  "resolution": "Resolución",
  "closed": "Cerrado",
};

const CaseDetailPage = () => {
  // --- State Management ---
  const router = useRouter();
  const params = useParams();
  const { caseId } = params;

  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isStageModalVisible, setIsStageModalVisible] = useState(false);

  // --- Data Fetching ---
  const fetchCaseDetails = async () => {
    if (!caseId) return;
    try {
      if (!loading) setLoading(true); // Show spinner on manual refresh
      // This is the corrected URL, pointing to the general protected route.
      const response = await apiClient.get(`/cases/${caseId}`);
      setCaseDetails(response.data);
    } catch (error) {
      message.error('No se pudo cargar los detalles del caso.');
    } finally {
      setLoading(false);
    }
  };

  // The `useEffect` hook runs the fetch function once when the component is first mounted.
  useEffect(() => {
    fetchCaseDetails();
  }, [caseId]); // It re-runs if the caseId in the URL changes.

  // --- Event Handlers for Tasks ---
  const handleCreateTask = () => {
    setEditingTask(null);
    setIsTaskModalVisible(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskModalVisible(true);
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      message.loading({ content: 'Eliminando tarea...', key: 'deleteTask' });
      await apiClient.delete(`/admin/tasks/${taskId}`);
      message.success({ content: 'Tarea eliminada.', key: 'deleteTask' });
      fetchCaseDetails(); // Refresh the data to show the change.
    } catch (error) {
      message.error({ content: 'No se pudo eliminar la tarea.', key: 'deleteTask' });
    }
  };

  // --- Table & Tab Definitions ---
  const taskColumns = [
    { title: 'Tarea', dataIndex: 'title', key: 'title' },
    { 
      title: 'Asignado a', 
      dataIndex: 'assignedTo', 
      key: 'assignedTo',
      render: (user: User) => user ? `${user.firstName} ${user.lastName}` : 'N/A'
    },
    { 
      title: 'Fecha Límite', 
      dataIndex: 'dueDate', 
      key: 'dueDate',
      render: (date: string | null) => date ? new Date(date).toLocaleDateString() : 'N/A'
    },
    { 
      title: 'Estado', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => <Tag color={status === 'completed' ? 'green' : 'orange'}>{status.toUpperCase()}</Tag>
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: Task) => (
        <span className="space-x-2">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditTask(record)} />
          <Popconfirm title="¿Eliminar esta tarea?" onConfirm={() => handleDeleteTask(record.id)}>
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </span>
      ),
    },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: '1',
      label: 'Historial y Comentarios',
      children: (
        <div>
          <AddCommentForm caseId={caseId as string} onSuccess={fetchCaseDetails} />
          <hr className="my-6" />
          <CaseTimeline events={caseDetails?.caseEvents || []} />
        </div>
      ),
    },
    {
      key: '2',
      label: 'Documentos',
      children: <UploadDocument caseId={caseId as string} onSuccess={fetchCaseDetails} />,
    },
    {
      key: '3',
      label: 'Tareas',
      children: (
        <div>
          <div className="text-right mb-4">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTask}>
              Crear Tarea
            </Button>
          </div>
          <Table
            columns={taskColumns}
            dataSource={caseDetails?.tasks || []}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: 'No hay tareas asociadas a este caso.' }}
          />
        </div>
      ),
    },
  ];

  // --- Render Logic ---
  if (loading) {
    return <div className="flex justify-center items-center h-full"><Spin size="large" /></div>;
  }

  if (!caseDetails) {
    return <Empty description="No se encontraron los detalles del caso." />;
  }

  return (
    <div>
      <Button 
        type="text" 
        icon={<ArrowLeftOutlined />} 
        onClick={() => router.back()}
        className="mb-4"
      >
        Volver a todos los casos
      </Button>

      <Card className="mb-6">
        <Descriptions title={`Resumen del Caso #${caseDetails.id}`} bordered column={1}>
          <Descriptions.Item label="Título">{caseDetails.title}</Descriptions.Item>
          <Descriptions.Item label="Cliente">{`${caseDetails.client.firstName} ${caseDetails.client.lastName}`}</Descriptions.Item>
          <Descriptions.Item label="Oficina">{caseDetails.office.name}</Descriptions.Item>
          <Descriptions.Item label="Estado del Caso">
            <Tag color={caseDetails.status === 'closed' ? 'green' : 'blue'}>{caseDetails.status.toUpperCase()}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Etapa del Proceso">
            <div className="flex items-center justify-between">
              <span>{STAGE_LABELS[caseDetails.currentStage] || caseDetails.currentStage}</span>
              <Button icon={<EditOutlined />} size="small" onClick={() => setIsStageModalVisible(true)}>
                Actualizar Etapa
              </Button>
            </div>
            <CaseProgressTracker
              allStages={ALL_STAGES}
              currentStage={caseDetails.currentStage}
              stageLabels={STAGE_LABELS}
            />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card>
        <Tabs defaultActiveKey="1" items={tabItems} />
      </Card>

      <TaskModal
        visible={isTaskModalVisible}
        onClose={() => setIsTaskModalVisible(false)}
        onSuccess={fetchCaseDetails}
        caseId={caseId as string}
        task={editingTask}
      />
      <EditStageModal
        visible={isStageModalVisible}
        onClose={() => setIsStageModalVisible(false)}
        onSuccess={fetchCaseDetails}
        caseId={caseId as string}
        currentStage={caseDetails.currentStage}
        allStages={ALL_STAGES}
        stageLabels={STAGE_LABELS}
      />
    </div>
  );
};

export default CaseDetailPage;












