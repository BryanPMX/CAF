// admin-portal/src/app/(dashboard)/admin/cases/[caseId]/components/UploadDocument.tsx (New File)
'use client';

import React, { useState } from 'react';
import { Upload, Button, message, Radio } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';

interface UploadDocumentProps {
  caseId: string;
  onSuccess: () => void;
}

const UploadDocument: React.FC<UploadDocumentProps> = ({ caseId, onSuccess }) => {
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [visibility, setVisibility] = useState('internal');

  const handleUpload = async () => {
    const formData = new FormData();
    if (fileList.length === 0) {
      message.error('Por favor, seleccione un archivo para subir.');
      return;
    }
    formData.append('file', fileList[0]);
    formData.append('visibility', visibility);
    setUploading(true);

    try {
      await apiClient.post(`/admin/cases/${caseId}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setFileList([]);
      message.success('Archivo subido exitosamente.');
      onSuccess();
    } catch (error) {
      message.error('Falló la subida del archivo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <Upload
        onRemove={() => setFileList([])}
        beforeUpload={file => {
          setFileList([file]);
          return false; // Prevent automatic upload
        }}
        fileList={fileList}
        maxCount={1}
      >
        <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
      </Upload>
      <Radio.Group className="mt-4" onChange={(e) => setVisibility(e.target.value)} value={visibility}>
        <Radio value="internal">Solo para Staff (Interno)</Radio>
        <Radio value="client_visible">Visible para el Cliente</Radio>
      </Radio.Group>
      <Button
        type="primary"
        onClick={handleUpload}
        disabled={fileList.length === 0}
        loading={uploading}
        style={{ marginTop: 16 }}
      >
        {uploading ? 'Subiendo...' : 'Subir Archivo'}
      </Button>
    </div>
  );
};

export default UploadDocument;