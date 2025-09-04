'use client';

import React, { useEffect, useState } from 'react';
import { Card, Tabs, List, Input, Button, Space, message, Spin, Empty, Image } from 'antd';
import { apiClient } from '../../lib/api';

interface AdminNote {
  id: number;
  bodyText: string;
  imageUrl?: string;
  pinned?: boolean;
}

interface UserNote {
  id: number;
  bodyText: string;
  pinned?: boolean;
}

const NotesPanel: React.FC = () => {
  const [adminNotes, setAdminNotes] = useState<AdminNote[]>([]);
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/dashboard/notes');
      setAdminNotes(res.data.adminNotes || []);
      setUserNotes(res.data.userNotes || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createNote = async () => {
    if (!newNote.trim()) return;
    try {
      setSaving(true);
      await apiClient.post('/notes', { bodyText: newNote });
      setNewNote('');
      await load();
      message.success('Nota creada');
    } finally {
      setSaving(false);
    }
  };

  const updateNote = async (note: UserNote) => {
    await apiClient.patch(`/notes/${note.id}`, { bodyText: note.bodyText, pinned: note.pinned });
    message.success('Nota actualizada');
  };

  const deleteNote = async (id: number) => {
    await apiClient.delete(`/notes/${id}`);
    setUserNotes(prev => prev.filter(n => n.id !== id));
    message.success('Nota eliminada');
  };

  if (loading) return <Spin />;

  return (
    <div className="mt-6">
      <Card title="Notas">
        <Tabs
          items={[
            {
              key: 'org',
              label: 'Organización',
              children: (
                <List
                  dataSource={adminNotes}
                  locale={{ emptyText: <Empty description="Sin notas" /> }}
                  renderItem={(n) => (
                    <List.Item>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {n.imageUrl && <Image src={n.imageUrl} width={240} />}
                        <div>{n.bodyText}</div>
                      </Space>
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'mine',
              label: 'Mis notas',
              children: (
                <>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input.TextArea rows={2} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Escribe una nota..." />
                    <Button type="primary" loading={saving} onClick={createNote}>Agregar</Button>
                  </Space.Compact>
                  <List
                    className="mt-4"
                    dataSource={userNotes}
                    locale={{ emptyText: <Empty description="Sin notas" /> }}
                    renderItem={(n) => (
                      <List.Item
                        actions={[
                          <Button size="small" onClick={() => updateNote(n)}>Guardar</Button>,
                          <Button size="small" danger onClick={() => deleteNote(n.id)}>Eliminar</Button>,
                        ]}
                      >
                        <Input.TextArea
                          rows={2}
                          defaultValue={n.bodyText}
                          onBlur={(e) => { n.bodyText = e.target.value; }}
                        />
                      </List.Item>
                    )}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default NotesPanel;


