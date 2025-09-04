// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/DocumentPreviewModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Spin, Button, message, Space, Typography } from 'antd';
import { EyeOutlined, DownloadOutlined, CloseOutlined, FilePdfOutlined, FileImageOutlined, FileTextOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface DocumentPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  documentId: number;
  fileName: string;
}

const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  visible,
  onClose,
  documentId,
  fileName
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('');

  // Get file extension and type
  const getFileExtension = (filename: string) => {
    return filename.toLowerCase().split('.').pop() || '';
  };

  const getFileIcon = (extension: string) => {
    switch (extension) {
      case 'pdf':
        return <FilePdfOutlined className="text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg':
        return <FileImageOutlined className="text-blue-500" />;
      case 'txt':
      case 'html':
      case 'htm':
        return <FileTextOutlined className="text-green-500" />;
      case 'docx':
      case 'doc':
        return <FileTextOutlined className="text-blue-600" />;
      default:
        return <FileTextOutlined className="text-gray-500" />;
    }
  };

  const isPreviewable = (extension: string) => {
    const previewableExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'txt', 'html', 'htm', 'docx', 'doc'];
    return previewableExtensions.includes(extension);
  };

  // Load document preview
  useEffect(() => {
    if (!visible || !documentId) return;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          throw new Error('No authentication token found');
        }

        const extension = getFileExtension(fileName);
        const canPreview = isPreviewable(extension);
        
        // Handle Word documents specially
        if (extension === 'docx' || extension === 'doc') {
          setError('Los documentos Word se abren en una nueva ventana. Use la opción de descarga si no se abre automáticamente.');
          setLoading(false);
          return;
        }
        
        if (!canPreview) {
          setError('Este tipo de archivo no se puede previsualizar. Use la opción de descarga.');
          setLoading(false);
          return;
        }

        const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'}/documents/${documentId}?mode=preview`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error al cargar el documento: ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        setFileType(extension);
        
      } catch (error: any) {
        console.error('Error loading document preview:', error);
        setError(error.message || 'Error al cargar la previsualización');
      } finally {
        setLoading(false);
      }
    };

    loadPreview();

    // Cleanup function
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [visible, documentId, fileName]);

  // Handle download
  const handleDownload = async () => {
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
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col justify-center items-center h-64 text-center">
          <div className="text-red-500 text-lg mb-2">⚠️</div>
          <Text type="danger">{error}</Text>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={handleDownload}
            className="mt-4"
          >
            Descargar Documento
          </Button>
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="flex justify-center items-center h-64">
          <Text type="secondary">No se pudo cargar la previsualización</Text>
        </div>
      );
    }

    // Render based on file type
    const extension = getFileExtension(fileName);
    
    if (extension === 'pdf') {
      return (
        <iframe
          src={previewUrl}
          className="w-full h-96 border-0"
          title={fileName}
        />
      );
    }
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      return (
        <div className="flex justify-center">
          <img
            src={previewUrl}
            alt={fileName}
            className="max-w-full max-h-96 object-contain"
            style={{ maxHeight: '24rem' }}
          />
        </div>
      );
    }
    
    if (['txt', 'html', 'htm'].includes(extension)) {
      return (
        <iframe
          src={previewUrl}
          className="w-full h-96 border border-gray-200 rounded"
          title={fileName}
        />
      );
    }

    return (
      <div className="flex justify-center items-center h-64">
        <Text type="secondary">Tipo de archivo no soportado para previsualización</Text>
      </div>
    );
  };

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2">
          {getFileIcon(getFileExtension(fileName))}
          <Title level={4} className="mb-0">{fileName}</Title>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={
        <div className="flex justify-between items-center">
          <Text type="secondary" className="text-sm">
            {fileType && `Tipo: ${fileType.toUpperCase()}`}
          </Text>
          <Space>
            <Button onClick={onClose} icon={<CloseOutlined />}>
              Cerrar
            </Button>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={handleDownload}
            >
              Descargar
            </Button>
          </Space>
        </div>
      }
      width={800}
      className="document-preview-modal"
      destroyOnClose
    >
      <div className="document-preview-content">
        {renderPreview()}
      </div>
    </Modal>
  );
};

export default DocumentPreviewModal;
