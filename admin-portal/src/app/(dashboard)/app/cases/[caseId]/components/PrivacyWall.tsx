/**
 * Case Detail Privacy Wall Component
 * 
 * Implements role-based access control for case documents and information
 * based on the centralized role configuration.
 */

import React from 'react';
import { Card, Alert, Typography, Tag, Space, Empty } from 'antd';
import { LockOutlined, EyeInvisibleOutlined, SecurityScanOutlined } from '@ant-design/icons';
import { 
  PERMISSIONS, 
  CASE_DOCUMENT_TYPES, 
  CASE_DOCUMENT_PERMISSIONS,
  canViewDocumentType,
  type StaffRoleKey 
} from '@/config/roles';

const { Text, Title } = Typography;

interface PrivacyWallProps {
  userRole: StaffRoleKey;
  documentType: string;
  children: React.ReactNode;
  fallbackMessage?: string;
}

export const PrivacyWall: React.FC<PrivacyWallProps> = ({
  userRole,
  documentType,
  children,
  fallbackMessage
}) => {
  const canView = canViewDocumentType(userRole, documentType);
  
  if (canView) {
    return <>{children}</>;
  }

  const getPrivacyMessage = () => {
    switch (documentType) {
      case CASE_DOCUMENT_TYPES.LEGAL:
        return "Solo los abogados y administradores pueden ver documentos legales.";
      case CASE_DOCUMENT_TYPES.PSYCHOLOGICAL:
        return "Solo los psicólogos y administradores pueden ver documentos psicológicos.";
      case CASE_DOCUMENT_TYPES.GENERAL:
        return "No tienes permisos para ver este contenido.";
      default:
        return fallbackMessage || "Acceso restringido por motivos de privacidad.";
    }
  };

  const getIcon = () => {
    switch (documentType) {
      case CASE_DOCUMENT_TYPES.LEGAL:
        return SecurityScanOutlined;
      case CASE_DOCUMENT_TYPES.PSYCHOLOGICAL:
        return LockOutlined;
      default:
        return EyeInvisibleOutlined;
    }
  };

  const getTagColor = () => {
    switch (documentType) {
      case CASE_DOCUMENT_TYPES.LEGAL:
        return 'blue';
      case CASE_DOCUMENT_TYPES.PSYCHOLOGICAL:
        return 'purple';
      default:
        return 'red';
    }
  };

  return (
    <Card className="privacy-wall">
      <div className="text-center py-8">
        <div className="mb-4">
          {React.createElement(getIcon(), { 
            style: { fontSize: '48px', color: '#d9d9d9' } 
          })}
        </div>
        
        <Title level={4} type="secondary" className="mb-2">
          Contenido Restringido
        </Title>
        
        <Text type="secondary" className="block mb-4">
          {getPrivacyMessage()}
        </Text>
        
        <Space direction="vertical" size="small">
          <Tag color={getTagColor()} icon={React.createElement(getIcon())}>
            {CASE_DOCUMENT_TYPES[documentType as keyof typeof CASE_DOCUMENT_TYPES] || 'Documento Restringido'}
          </Tag>
          
          <Text type="secondary" className="text-xs">
            Tu rol: {userRole}
          </Text>
        </Space>
      </div>
    </Card>
  );
};

interface DocumentTabProps {
  userRole: StaffRoleKey;
  documentType: string;
  children: React.ReactNode;
  tabKey: string;
  tabLabel: string;
}

export const DocumentTab: React.FC<DocumentTabProps> = ({
  userRole,
  documentType,
  children,
  tabKey,
  tabLabel
}) => {
  const canView = canViewDocumentType(userRole, documentType);
  
  if (canView) {
    return <>{children}</>;
  }
  
  return (
    <PrivacyWall userRole={userRole} documentType={documentType}>
      {children}
    </PrivacyWall>
  );
};

interface CaseDocumentFilterProps {
  userRole: StaffRoleKey;
  documents: Array<{
    id: string;
    type: string;
    title: string;
    url: string;
    uploadedBy: string;
    uploadedAt: string;
  }>;
}

export const CaseDocumentFilter: React.FC<CaseDocumentFilterProps> = ({
  userRole,
  documents
}) => {
  const filteredDocuments = documents.filter(doc => {
    return canViewDocumentType(userRole, doc.type);
  });

  return (
    <div className="case-documents">
      {filteredDocuments.length > 0 ? (
        <div className="space-y-3">
          {filteredDocuments.map(doc => (
            <Card key={doc.id} size="small" className="document-item">
              <div className="flex justify-between items-center">
                <div>
                  <Text strong>{doc.title}</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    Subido por {doc.uploadedBy} • {new Date(doc.uploadedAt).toLocaleDateString()}
                  </Text>
                </div>
                <Tag color={doc.type === CASE_DOCUMENT_TYPES.LEGAL ? 'blue' : 
                           doc.type === CASE_DOCUMENT_TYPES.PSYCHOLOGICAL ? 'purple' : 'default'}>
                   {CASE_DOCUMENT_TYPES[doc.type as keyof typeof CASE_DOCUMENT_TYPES] || 'General'}
                </Tag>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <PrivacyWall userRole={userRole} documentType={CASE_DOCUMENT_TYPES.GENERAL}>
          <Empty description="No hay documentos disponibles" />
        </PrivacyWall>
      )}
    </div>
  );
};

interface CaseCommentFilterProps {
  userRole: StaffRoleKey;
  comments: Array<{
    id: string;
    text: string;
    type: string;
    author: string;
    createdAt: string;
  }>;
}

export const CaseCommentFilter: React.FC<CaseCommentFilterProps> = ({
  userRole,
  comments
}) => {
  const filteredComments = comments.filter(comment => {
    // General comments are visible to all roles
    if (comment.type === CASE_DOCUMENT_TYPES.GENERAL) {
      return true;
    }
    
    // Check specific document type permissions
    return canViewDocumentType(userRole, comment.type);
  });

  return (
    <div className="case-comments">
      {filteredComments.length > 0 ? (
        <div className="space-y-3">
          {filteredComments.map(comment => (
            <Card key={comment.id} size="small" className="comment-item">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <Text strong>{comment.author}</Text>
                  <Tag color={comment.type === CASE_DOCUMENT_TYPES.LEGAL ? 'blue' : 
                             comment.type === CASE_DOCUMENT_TYPES.PSYCHOLOGICAL ? 'purple' : 'default'}>
                     {CASE_DOCUMENT_TYPES[comment.type as keyof typeof CASE_DOCUMENT_TYPES] || 'General'}
                  </Tag>
                </div>
                <Text>{comment.text}</Text>
                <Text type="secondary" className="text-xs">
                  {new Date(comment.createdAt).toLocaleString()}
                </Text>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty description="No hay comentarios disponibles" />
      )}
    </div>
  );
};

export default PrivacyWall;
