'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Spin } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { apiClient } from '@/app/lib/api';
import type { OwnProfile } from '@/app/lib/profile';
import { useAuth } from '@/context/AuthContext';
import { canManageUser } from '@/config/roles';
import { PROFILE_TEXT as text } from '@/config/profile';
import ProfileCard from '@/components/profile/ProfileCard';
import ProfilePhotoEditor from '@/components/profile/ProfilePhotoEditor';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const endpoint = user?.role === 'client' ? '/client/profile' : '/profile';
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const userID = user?.id;

  useEffect(() => {
    if (!userID) return;
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    apiClient.get<OwnProfile>(endpoint, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setProfile(response.data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, userID, revision]);

  // Synchronize only display fields from the authorized response, including an
  // empty avatar after removal. AuthContext keeps role permissions authoritative.
  useEffect(() => {
    if (!profile || !user || Number(profile.userID) !== user.id) return;
    if (user.avatarUrl !== profile.avatarUrl || user.firstName !== profile.firstName || user.lastName !== profile.lastName || user.email !== profile.email) {
      updateUser({ ...user, avatarUrl: profile.avatarUrl, firstName: profile.firstName, lastName: profile.lastName, email: profile.email });
    }
  }, [profile, user, updateUser]);

  const retry = () => setRevision(value => value + 1);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900">{text.ownTitle}</h1>
          <p className="m-0 text-sm text-slate-500">{text.description}</p>
        </div>
        {profile && canManageUser(user, profile) && <Button aria-label={text.edit} icon={<FormOutlined />} onClick={() => router.push(`/app/users?edit=${profile.userID}`)}>{text.edit}</Button>}
      </div>
      {error && <Alert type="error" showIcon message={text.loadError} action={<Button size="small" onClick={retry}>{text.retry}</Button>} />}
      {loading && !profile && <div role="status" aria-label={text.loading} className="flex min-h-64 items-center justify-center"><Spin size="large" /></div>}
      {profile && (
        <ProfileCard profile={profile} avatarUrl={profile.avatarUrl}>
          {profile.avatarPolicy && <ProfilePhotoEditor endpoint={endpoint} policy={profile.avatarPolicy} hasPhoto={Boolean(profile.avatarUrl)} onUpdated={retry} />}
        </ProfileCard>
      )}
      {profile && !canManageUser(user, profile) && <p className="text-sm leading-6 text-slate-500">{text.supportHint}</p>}
    </div>
  );
}
