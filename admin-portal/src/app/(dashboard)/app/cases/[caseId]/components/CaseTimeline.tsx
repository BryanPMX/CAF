// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/CaseTimeline.tsx
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Timeline, Tag, Button, Popconfirm, message, Space, Dropdown } from 'antd';
import { CommentOutlined, FilePdfOutlined, FileTextOutlined, PaperClipOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined, MoreOutlined } from '@ant-design/icons';
import { apiClient } from '../../../../../lib/api';
import EditCommentModal from './EditCommentModal';
import EditDocumentModal from './EditDocumentModal';
import DocumentPreviewModal from './DocumentPreviewModal';

// Define the structures for our timeline events
interface User {
  id: number;
  firstName: string;
  lastName: string;
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

interface CaseTimelineProps {
  events: CaseEvent[];
  onRefresh: () => void;
}

// Optimized API base URL - memoized to prevent unnecessary recalculations
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// Memoized helper functions for better performance
const getDocumentUrl = (id: number) => `${API_BASE_URL}/documents/${id}`;

const getFileIcon = (fileName: string) => {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  switch (extension) {
    case 'pdf':
      return <FilePdfOutlined />;
    case 'docx':
    case 'doc':
      return <FileTextOutlined />;
    default:
      return <PaperClipOutlined />;
  }
};

const CaseTimeline: React.FC<CaseTimelineProps> = ({ events, onRefresh }) => {
  const [loadingDocs, setLoadingDocs] = useState<Set<number>>(new Set());
  const [errorDocs, setErrorDocs] = useState<Set<number>>(new Set());
  const [editCommentModalVisible, setEditCommentModalVisible] = useState(false);
  const [editDocumentModalVisible, setEditDocumentModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedComment, setSelectedComment] = useState<CaseEvent | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<CaseEvent | null>(null);
  const [previewDocument, setPreviewDocument] = useState<CaseEvent | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');

  // Get current user info on component mount
  React.useEffect(() => {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    
    if (token) {
      // Decode JWT to get user info (simplified approach)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUser(payload);
        setUserRole(role || payload.role || '');
      } catch (error) {
        console.error('Error decoding token:', error);
        // Fallback to localStorage role
        setUserRole(role || '');
      }
    }
  }, []);

  // Check if user can edit an item (only the author)
  const canEditItem = useCallback((item: CaseEvent) => {
    if (!currentUser) return false;
    // JWT payload uses 'sub' for user ID, convert to number for comparison
    const currentUserId = parseInt(currentUser.sub || currentUser.userID || '0', 10);
    return currentUserId === item.user.id;
  }, [currentUser]);

  // Check if user can delete an item (only admins and office managers)
  const canDeleteItem = useCallback(() => {
    if (!userRole) return false;
    return userRole === 'admin' || userRole === 'office_manager';
  }, [userRole]);

  // Check if file can be previewed or opened
  const canPreviewFile = useCallback((fileName: string) => {
    const extension = fileName.toLowerCase().split('.').pop() || '';
    // PDFs and images can be previewed in browser, Word docs will be downloaded
    const previewableExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'txt', 'html', 'htm', 'docx', 'doc'];
    return previewableExtensions.includes(extension);
  }, []);

  // Optimized document click handler with useCallback
  const handleDocumentClick = useCallback(async (eventId: number, fileName: string) => {
    try {
      setLoadingDocs(prev => new Set(prev).add(eventId));
      setErrorDocs(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });

      const url = getDocumentUrl(eventId);
      
      // Use fetch API for better performance and error handling
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      
      // Open document in new tab for better user experience
      const newWindow = window.open(objectUrl, '_blank');
      if (!newWindow) {
        // If popup is blocked, show a message and provide download option
        message.info('Ventana emergente bloqueada. El documento se abrirá en una nueva pestaña.');
        window.open(objectUrl, '_blank');
      }

      // Clean up object URL after a delay to prevent memory leaks
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000); // 1 minute
      
    } catch (error) {
      console.error('Error opening document:', error);
      message.error('Error al abrir el documento. Intente descargarlo.');
      setErrorDocs(prev => new Set(prev).add(eventId));
    } finally {
      setLoadingDocs(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
    }
  }, []);

  // Preview document handler
  const handlePreviewDocument = useCallback(async (docEvent: CaseEvent) => {
    const fileName = docEvent.fileName || '';
    const extension = fileName.toLowerCase().split('.').pop() || '';
    
    // Handle Word documents with direct download approach
    if (extension === 'docx' || extension === 'doc') {
      try {
        message.loading({ content: 'Descargando documento...', key: 'wordPreview' });
        
        // Download the document directly
        const token = localStorage.getItem('authToken');
        if (!token) {
          message.error('No se encontró el token de autenticación');
          return;
        }

        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/documents/${docEvent.id}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error al descargar: ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        // Create download link and trigger download
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        message.success({ 
          content: 'Documento Word descargado. Ábralo con su aplicación predeterminada.', 
          key: 'wordPreview' 
        });
        
        // Clean up object URL after a delay
        setTimeout(() => URL.revokeObjectURL(objectUrl), 300000); // 5 minutes
        
      } catch (error) {
        console.error('Error downloading Word document:', error);
        message.error({ content: 'Error al descargar el documento Word', key: 'wordPreview' });
      }
    } else {
      // Use existing preview modal for other file types
      setPreviewDocument(docEvent);
      setPreviewModalVisible(true);
    }
  }, []);

  // Download document handler
  const handleDownloadDocument = useCallback(async (documentId: number, fileName: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        message.error('No se encontró el token de autenticación');
        return;
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/documents/${documentId}?mode=download`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Error al descargar: ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(downloadUrl);
      message.success('Descarga iniciada');
      
    } catch (error: any) {
      console.error('Error downloading document:', error);
      message.error('Error al descargar el documento');
    }
  }, []);

  // Edit comment handler
  const handleEditComment = useCallback((comment: CaseEvent) => {
    setSelectedComment(comment);
    setEditCommentModalVisible(true);
  }, []);

  // Edit document handler
  const handleEditDocument = useCallback((document: CaseEvent) => {
    setSelectedDocument(document);
    setEditDocumentModalVisible(true);
  }, []);

  // Delete comment handler
  const handleDeleteComment = useCallback(async (commentId: number) => {
    try {
      await apiClient.delete(`/cases/comments/${commentId}`);
      message.success('Comentario eliminado exitosamente.');
      onRefresh();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al eliminar el comentario';
      message.error(errorMessage);
    }
  }, [onRefresh]);

  // Delete document handler
  const handleDeleteDocument = useCallback(async (documentId: number) => {
    try {
      await apiClient.delete(`/cases/documents/${documentId}`);
      message.success('Documento eliminado exitosamente.');
      onRefresh();
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Error al eliminar el documento';
      message.error(errorMessage);
    }
  }, [onRefresh]);

  // Memoized event icon getter
  const getEventIcon = useCallback((eventType: string) => {
    switch (eventType) {
      case 'comment':
        return <CommentOutlined />;
      case 'file_upload':
        return <PaperClipOutlined />;
      default:
        return null;
    }
  }, []);

  // Memoized timeline items for better performance
  const timelineItems = useMemo(() => 
    events.map(event => (
      <Timeline.Item key={event.id} dot={getEventIcon(event.eventType)}>
        <div className="flex justify-between">
          <span className="font-semibold">{`${event.user.firstName} ${event.user.lastName}`}</span>
          <span className="text-xs text-gray-500">
            {new Date(event.createdAt).toLocaleString()}
          </span>
        </div>
        
        {event.eventType === 'comment' && (
          <div className="mt-1">
            <p className="bg-gray-50 p-3 rounded-md">{event.commentText}</p>
            <div className="mt-2 flex justify-end space-x-2">
              {canEditItem(event) && (
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEditComment(event)}
                >
                  Editar
                </Button>
              )}
              {canDeleteItem() && (
                <Popconfirm
                  title="¿Está seguro de que desea eliminar este comentario?"
                  onConfirm={() => handleDeleteComment(event.id)}
                  okText="Sí"
                  cancelText="No"
                >
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                  >
                    Eliminar
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
        )}
        
        {event.eventType === 'file_upload' && event.fileName && (
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  icon={getFileIcon(event.fileName)}
                  onClick={() => handleDocumentClick(event.id, event.fileName || '')}
                  loading={loadingDocs.has(event.id)}
                  className={`${errorDocs.has(event.id) ? 'border-red-500' : ''} p-0 h-auto text-left`}
                  type="link"
                >
                  {event.fileName}
                </Button>
              </div>
              <Space>
                                 {/* Preview/Download Button - Primary Action */}
                 {canPreviewFile(event.fileName) && (
                   <Button
                     type="primary"
                     size="small"
                     icon={<EyeOutlined />}
                     onClick={() => handlePreviewDocument(event)}
                   >
                     {event.fileName?.toLowerCase().endsWith('.docx') || event.fileName?.toLowerCase().endsWith('.doc') ? 'Abrir' : 'Previsualizar'}
                   </Button>
                 )}
                
                {/* Download Button - Secondary Action */}
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadDocument(event.id, event.fileName || '')}
                >
                  Descargar
                </Button>
                
                {/* Edit Button - Only for authors */}
                {canEditItem(event) && (
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEditDocument(event)}
                  >
                    Editar
                  </Button>
                )}
                
                {/* Delete Button - Only for admins/managers */}
                {canDeleteItem() && (
                  <Popconfirm
                    title="¿Está seguro de que desea eliminar este documento?"
                    description="Esta acción eliminará permanentemente el archivo."
                    onConfirm={() => handleDeleteDocument(event.id)}
                    okText="Sí"
                    cancelText="No"
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    >
                      Eliminar
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </div>
            
            {errorDocs.has(event.id) && (
              <p className="text-red-500 text-xs mt-1">
                Error al abrir el documento. Intente nuevamente.
              </p>
            )}
          </div>
        )}
        
        <Tag color={event.visibility === 'client_visible' ? 'green' : 'red'}>
          {event.visibility === 'client_visible' ? 'VISIBLE PARA CLIENTE' : 'INTERNO'}
        </Tag>
      </Timeline.Item>
    )), [events, getEventIcon, getFileIcon, handleDocumentClick, loadingDocs, errorDocs, canEditItem, canDeleteItem, handleEditComment, handleEditDocument, handleDeleteComment, handleDeleteDocument]);

  return (
    <>
      <Timeline>
        {timelineItems}
      </Timeline>

      {/* Edit Comment Modal */}
      <EditCommentModal
        visible={editCommentModalVisible}
        onClose={() => {
          setEditCommentModalVisible(false);
          setSelectedComment(null);
        }}
        onSuccess={onRefresh}
        comment={selectedComment}
      />

      {/* Edit Document Modal */}
      <EditDocumentModal
        visible={editDocumentModalVisible}
        onClose={() => {
          setEditDocumentModalVisible(false);
          setSelectedDocument(null);
        }}
        onSuccess={onRefresh}
        document={selectedDocument}
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        visible={previewModalVisible}
        onClose={() => {
          setPreviewModalVisible(false);
          setPreviewDocument(null);
        }}
        documentId={previewDocument?.id || 0}
        fileName={previewDocument?.fileName || ''}
      />
    </>
  );
};

export default CaseTimeline;
