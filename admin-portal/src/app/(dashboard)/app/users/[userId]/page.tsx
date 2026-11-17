'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Button, Card, Spin, Table } from 'antd';
import { ArrowLeftOutlined, FormOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import { formatProfileDate, type ProfileOffice, type UserProfile } from '@/app/lib/profile';
import { useAuth } from '@/context/AuthContext';
import { canManageUser } from '@/config/roles';
import { PROFILE_TEXT as text } from '@/config/profile';
import OrganizationLinks from '@/components/organizations/OrganizationLinks';
import ProfileLayout from '@/components/profile/ProfileLayout';
import ProfileCard from '@/components/profile/ProfileCard';

interface ContactSubmission {
  id: number;
  message: string;
  createdAt: string;
}
interface UserDetailResponse {
  user: UserProfile;
  organizationInfo?: UserProfile['organizationInfo'];
  office: ProfileOffice;
  contactSubmissions?: ContactSubmission[];
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const userID = params?.userId as string | undefined;
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const base = user?.role === 'office_manager' ? '/manager' : '/admin';

  useEffect(() => {
    if (!userID) return;
    const controller = new AbortController();
    setData(null);
    setError(false);
    setLoading(true);
    apiClient.get<UserDetailResponse>(`${base}/users/${userID}`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setData(response.data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userID, base, revision]);

  const profile = data ? { ...data.user, organizationInfo: data.organizationInfo, office: data.user.office || data.office } : null;
  const messages = data?.contactSubmissions ?? [];
  return (
    <ProfileLayout title={text.userTitle} actions={<>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => router.push('/app/users')}>{text.back}</Button>
      {profile && canManageUser(user, profile) && <Button type="primary" aria-label={text.edit} icon={<FormOutlined />} onClick={() => router.push(`/app/users?edit=${userID}`)}>{text.edit}</Button>}
    </>}>
      {!userID && <Alert type="error" message={text.invalidId} showIcon />}
      {error && <Alert type="error" message={text.loadError} showIcon action={<Button size="small" onClick={() => setRevision(value => value + 1)}>{text.retry}</Button>} />}
      {userID && loading && <div role="status" aria-label={text.loading} className="flex min-h-64 items-center justify-center"><Spin size="large" /></div>}
      {profile && <ProfileCard profile={profile}><OrganizationLinks memberships={profile.organizationMemberships}/></ProfileCard>}
      {profile?.role === 'client' && messages.length > 0 && (
        <Card title={text.messages.title}>
          <Table dataSource={messages} rowKey="id" pagination={{ pageSize: 5, hideOnSinglePage: true }} size="small" columns={[
            { title: text.messages.date, dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (value: string) => formatProfileDate(value, true) || text.missing },
            { title: text.messages.message, dataIndex: 'message', key: 'message', ellipsis: true },
          ]} />
        </Card>
      )}
    </ProfileLayout>
  );
}
