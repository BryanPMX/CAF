// admin-portal/src/app/(dashboard)/app/cases/[caseId]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Descriptions, Card, Table, Tag, Spin, message, Button, Empty, Row, Col, Tabs, Popconfirm, Modal, Input } from 'antd';
import type { TabsProps } from 'antd';
import { useHydrationSafe } from '@/hooks/useHydrationSafe';
import { ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { CaseService } from '@/services/caseService';
import { TaskService } from '@/services/taskService';
import { useAuth } from '@/hooks/useAuth';
import { CaseDetails } from '@/app/lib/types';
import CaseTimeline from './components/CaseTimeline';
import AddCommentForm from './components/AddCommentForm';
import UploadDocument from './components/UploadDocument';
import TaskModal from './components/TaskModal';
import CaseProgressTracker from './components/CaseProgressTracker';
import EditStageModal from './components/EditStageModal';
import EditCaseModal from './components/EditCaseModal';
import CompleteCaseModal from './components/CompleteCaseModal';
import PrivacyWall, { DocumentTab, CaseDocumentFilter, CaseCommentFilter } from './components/PrivacyWall';
import { 
  PERMISSIONS, 
  CASE_DOCUMENT_TYPES, 
  STAFF_ROLES,
  type StaffRoleKey 
} from '@/config/roles';

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

// CaseDetails interface is now imported from types

// Define the stages and their Spanish labels, matching the backend configuration.
const getCaseStages = (category: string) => {
  // Legal cases use specific legal workflow stages
  if (category === 'Familiar' || category === 'Civil') {
    return [
      "etapa_inicial",
      "notificacion", 
      "audiencia_preliminar",
      "audiencia_juicio",
      "sentencia"
    ];
  }
  
  // Default stages for non-legal cases
  return [
    "intake", 
    "initial_consultation", 
    "document_review", 
    "action_plan", 
    "resolution", 
    "closed"
  ];
};

const getStageLabels = (category: string): { [key: string]: string } => {
  // Legal case stage labels
  if (category === 'Familiar' || category === 'Civil') {
    return {
      "etapa_inicial": "Etapa Inicial",
      "notificacion": "Notificación",
      "audiencia_preliminar": "Audiencia Preliminar",
      "audiencia_juicio": "Audiencia de Juicio",
      "sentencia": "Sentencia",
    };
  }
  
  // Psychology case stage labels
  if (category === 'Psicologia') {
    return {
      "intake": "Recepción",
      "initial_consultation": "Consulta Inicial",
      "document_review": "Revisión de Documentos",
      "action_plan": "Plan de Acción",
      "resolution": "Resolución",
      "closed": "Cerrado",
    };
  }
  
  // Social Resources case stage labels
  if (category === 'Recursos') {
    return {
      "intake": "Recepción",
      "initial_consultation": "Consulta Inicial",
      "document_review": "Revisión de Documentos",
      "action_plan": "Plan de Acción",
      "resolution": "Resolución",
      "closed": "Cerrado",
    };
  }
  
  // Default stage labels for any other category
  return {
    "intake": "Recepción",
    "initial_consultation": "Consulta Inicial",
    "document_review": "Revisión de Documentos",
    "action_plan": "Plan de Acción",
    "resolution": "Resolución",
    "closed": "Cerrado",
  };
};

// Define status labels in Spanish
const STATUS_LABELS: { [key: string]: string } = {
  "open": "Abierto",
  "active": "Activo",
  "resolved": "Resuelto",
  "closed": "Cerrado",
  "pending": "Pendiente",
  "cancelled": "Cancelado",
  "deleted": "Eliminado",
};

// Define status colors for better visual representation
const STATUS_COLORS: { [key: string]: string } = {
  "open": "green",       // Green always for Abierto
  "active": "green",
  "resolved": "red",     // Closed-like outcome colored red per request
  "closed": "red",       // Red always for Cerrado
  "pending": "gold",     // Yellow for Pending (gold in AntD)
  "cancelled": "red",
  "deleted": "red",
};

const CaseDetailPage = () => {
  // --- State Management ---
  const router = useRouter();
  const params = useParams();
  const isHydrated = useHydrationSafe();
  const { user } = useAuth();
  const { caseId } = params;

  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isStageModalVisible, setIsStageModalVisible] = useState(false);
  const [isEditCaseModalVisible, setIsEditCaseModalVisible] = useState(false);
  const [completeCaseModalVisible, setCompleteCaseModalVisible] = useState(false);
  const [isDeletingCase, setIsDeletingCase] = useState(false);
  const [forceDeleteRequired, setForceDeleteRequired] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);

  // --- Data Fetching ---
  const fetchCaseDetails = async () => {
    if (!caseId) return;
    try {
      setLoading(true);
      
      // Wait for user to be loaded before fetching
      if (!user?.role) {
        console.log('User role not yet loaded, skipping fetch');
        setLoading(false);
        return;
      }

      // Use centralized service layer with role-based endpoint routing
      const data = await CaseService.fetchCaseById(
        user.role,
        caseId as string,
        'full' // Get all data in one request for better performance
      );
      
      setCaseDetails(data);
      setLoading(false);
      
    } catch (error) {
      message.error('No se pudo cargar los detalles del caso.');
      setLoading(false);
    }
  };

  // The `useEffect` hook runs the fetch function once when the component is first mounted or when user changes.
  useEffect(() => {
    fetchCaseDetails();
  }, [caseId, user]); // It re-runs if the caseId in the URL changes or user changes.

  // Get user role from auth context
  useEffect(() => {
    if (user?.role) {
      setUserRole(user.role);
    }
  }, [user?.role]);

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
      // Wait for user to be loaded before deleting
      if (!user?.role) {
        message.error('Usuario no autenticado');
        return;
      }

      message.loading({ content: 'Eliminando tarea...', key: 'deleteTask' });
      await TaskService.deleteTask(user.role, taskId.toString());
      message.success({ content: 'Tarea eliminada.', key: 'deleteTask' });
      fetchCaseDetails(); // Refresh the data to show the change.
    } catch (error) {
      message.error({ content: 'No se pudo eliminar la tarea.', key: 'deleteTask' });
    }
  };

  const tryDeleteCase = async (force: boolean = false) => {
    if (!caseId) return;
    try {
      // Wait for user to be loaded before deleting
      if (!user?.role) {
        message.error('Usuario no autenticado');
        return;
      }

      setIsDeletingCase(true);
      await CaseService.deleteCase(user.role, caseId as string);
      message.success('Caso eliminado exitosamente');
      router.push('/app/cases');
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      if (status === 400 && typeof data?.error === 'string' && data.error.toLowerCase().includes('requiere confirmación')) {
        setForceDeleteRequired(true);
        message.warning('Este caso requiere confirmación de eliminación forzada. Proporcione una razón.');
      } else if (status === 403 && data?.details) {
        const a = data.details.activeAppointments ?? 0;
        const t = data.details.pendingTasks ?? 0;
        message.error(`No se puede eliminar: ${a} citas activas, ${t} tareas pendientes.`);
      } else {
        message.error(data?.error || 'No se pudo eliminar el caso.');
      }
    } finally {
      setIsDeletingCase(false);
    }
  };

  const handleDeleteCase = async () => {
    await tryDeleteCase(false);
  };

  const handleForceDelete = async () => {
    await tryDeleteCase(true);
    setForceDeleteRequired(false);
    setDeleteReason('');
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

  // Get user role for permission checking
  const staffRole = userRole && Object.values(STAFF_ROLES).includes(userRole as StaffRoleKey) 
    ? userRole as StaffRoleKey 
    : STAFF_ROLES.RECEPTIONIST; // Default fallback

  const tabItems: TabsProps['items'] = [
    {
      key: '1',
      label: 'Historial y Comentarios',
      children: (
        <div>
          <AddCommentForm caseId={caseId as string} onSuccess={fetchCaseDetails} />
          <hr className="my-6" />
          <PrivacyWall userRole={staffRole} documentType={CASE_DOCUMENT_TYPES.GENERAL}>
            <CaseTimeline events={caseDetails?.caseEvents || []} onRefresh={fetchCaseDetails} />
          </PrivacyWall>
        </div>
      ),
    },
    {
      key: '2',
      label: 'Documentos',
      children: (
        <PrivacyWall userRole={staffRole} documentType={CASE_DOCUMENT_TYPES.GENERAL}>
          <UploadDocument caseId={caseId as string} onSuccess={fetchCaseDetails} />
        </PrivacyWall>
      ),
    },
    {
      key: '3',
      label: 'Tareas',
      children: (
        <div>
          <div className="text-right mb-4">
            {PERMISSIONS.canManageUsers(staffRole) && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTask}>
                Crear Tarea
              </Button>
            )}
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
      <div className="flex justify-between items-center mb-4">
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => router.back()}
        >
          Volver a todos los casos
        </Button>
        <Popconfirm 
          title="¿Eliminar este caso?"
          description="Esta acción archivará el caso y cancelará citas/tareas relacionadas."
          onConfirm={handleDeleteCase}
          okText="Sí"
          cancelText="No"
        >
          <Button danger icon={<DeleteOutlined />} loading={isDeletingCase}>
            Eliminar Caso
          </Button>
        </Popconfirm>
      </div>

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Resumen del Caso #{caseDetails.id}</h2>
          <div className="flex space-x-2">
            {!caseDetails.isCompleted && userRole && (userRole === 'admin' || userRole === 'office_manager') && (
              <Button 
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => setCompleteCaseModalVisible(true)}
                className="bg-green-500 hover:bg-green-600"
              >
                Completar Caso
              </Button>
            )}
            {PERMISSIONS.canManageUsers(staffRole) && (
              <Button 
                type="primary" 
                icon={<EditOutlined />}
                onClick={() => setIsEditCaseModalVisible(true)}
              >
                Editar Caso
              </Button>
            )}
          </div>
        </div>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Título">{caseDetails.title}</Descriptions.Item>
          <Descriptions.Item label="Cliente">
            {caseDetails.client
              ? `${caseDetails.client.firstName} ${caseDetails.client.lastName}`
              : 'Cliente eliminado o no disponible'}
          </Descriptions.Item>
          <Descriptions.Item label="Oficina">{caseDetails.office.name}</Descriptions.Item>
          <Descriptions.Item label="Departamento">{caseDetails.category}</Descriptions.Item>
          <Descriptions.Item label="Número de Expediente">
            {caseDetails.docketNumber || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Juzgado">
            {caseDetails.court || '-'}
          </Descriptions.Item>
          {caseDetails.description && (
            <Descriptions.Item label="Descripción">
              {caseDetails.description}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Estado del Caso">
            <Tag color={STATUS_COLORS[caseDetails.status] || 'default'}>
              {STATUS_LABELS[caseDetails.status] || caseDetails.status.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Etapa del Proceso">
            <div className="flex items-center justify-between">
              <span>{getStageLabels(caseDetails.category)[caseDetails.currentStage] || caseDetails.currentStage}</span>
              {PERMISSIONS.canManageUsers(staffRole) && (
                <Button icon={<EditOutlined />} size="small" onClick={() => setIsStageModalVisible(true)}>
                  Actualizar Etapa
                </Button>
              )}
            </div>
            <CaseProgressTracker
              allStages={getCaseStages(caseDetails.category)}
              currentStage={caseDetails.currentStage}
              stageLabels={getStageLabels(caseDetails.category)}
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
        allStages={getCaseStages(caseDetails.category)}
        stageLabels={getStageLabels(caseDetails.category)}
      />

      <EditCaseModal
        visible={isEditCaseModalVisible}
        onClose={() => setIsEditCaseModalVisible(false)}
        onSuccess={fetchCaseDetails}
        caseId={caseId as string}
        caseData={{
          title: caseDetails.title,
          category: caseDetails.category,
          docketNumber: caseDetails.docketNumber,
          court: caseDetails.court,
          description: caseDetails.description || '',
        }}
      />

      <CompleteCaseModal
        visible={completeCaseModalVisible}
        onClose={() => setCompleteCaseModalVisible(false)}
        onSuccess={() => {
          message.success('Caso completado exitosamente');
          router.push('/app/cases');
        }}
        caseId={parseInt(caseId as string)}
        caseTitle={caseDetails.title}
      />

      <Modal
        title="Confirmar eliminación forzada"
        open={forceDeleteRequired}
        onOk={handleForceDelete}
        onCancel={() => setForceDeleteRequired(false)}
        okText="Eliminar definitivamente"
        cancelText="Cancelar"
        confirmLoading={isDeletingCase}
      >
        <p>Este caso contiene datos significativos. Confirme la eliminación forzada e indique una razón:</p>
        <Input.TextArea
          rows={3}
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
          placeholder="Razón de eliminación (opcional)"
        />
      </Modal>
    </div>
  );
};

export default CaseDetailPage;












