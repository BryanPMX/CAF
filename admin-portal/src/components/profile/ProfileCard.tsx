'use client';

import { useState, type ReactNode } from 'react';
import { Avatar, Card, Tag } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import AuthAvatar from '@/app/(dashboard)/components/AuthAvatar';
import { formatProfileDate, getProfileInitials, getProfileName, type UserProfile } from '@/app/lib/profile';
import { canAccessAllOffices, getRoleDisplayName } from '@/config/roles';
import { PROFILE_TEXT as text } from '@/config/profile';

function ProfileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-sm text-slate-500">{label}</dt>
      <dd className="m-0 break-words text-sm font-medium leading-6 text-slate-800">{children}</dd>
    </div>
  );
}

function ProfileAvatar({ profile, avatarUrl }: { profile: UserProfile; avatarUrl?: string }) {
  const [failedURL, setFailedURL] = useState<string | null>(null);
  const initials = getProfileInitials(profile);
  if (avatarUrl && failedURL !== avatarUrl) {
    return <AuthAvatar avatarUrl={avatarUrl} alt={getProfileName(profile)} size={88} className="shrink-0" onError={() => setFailedURL(avatarUrl)} />;
  }
  return <Avatar size={88} className="shrink-0 !bg-teal-50 !text-2xl !font-semibold !text-teal-800" icon={!initials ? <UserOutlined /> : undefined}>{initials || null}</Avatar>;
}

export default function ProfileCard({ profile, avatarUrl, children }: {
  profile: UserProfile;
  // Only pass an avatar URL authorized for the currently signed-in user.
  avatarUrl?: string;
  children?: ReactNode;
}) {
  const memberSince = formatProfileDate(profile.createdAt);
  const lastLogin = formatProfileDate(profile.lastLogin, true);
  const hasAccountDates = Boolean(memberSince || lastLogin);
  const hasOffice = !canAccessAllOffices(profile.role) && (profile.role !== 'client' || profile.officeId);
  return (
    <Card className="overflow-hidden" styles={{ body: { padding: 0 } }}>
      <div className="flex flex-col items-start gap-4 border-b border-slate-100 bg-slate-50/70 p-6 sm:flex-row sm:items-center sm:gap-5 sm:p-8">
        <ProfileAvatar profile={profile} avatarUrl={avatarUrl} />
        <div className="min-w-0 flex-1">
          <h2 className="mb-3 break-words text-2xl font-semibold tracking-tight text-slate-900">{getProfileName(profile) || text.fallbackName}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Tag color="cyan" className="!m-0">{getRoleDisplayName(profile.role)}</Tag>
            {typeof profile.isActive === 'boolean' && <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${profile.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{profile.isActive ? text.active : text.inactive}</span>}
          </div>
        </div>
      </div>
      <section aria-label={text.contact} className="p-6 sm:p-8">
        <h3 className="mb-5 text-sm font-semibold text-slate-900">{text.contact}</h3>
        <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          <ProfileField label={text.email}>{profile.email || text.missing}</ProfileField>
          <ProfileField label={text.phone}>{profile.phone?.trim() || text.missing}</ProfileField>
          {hasOffice && <ProfileField label={text.office}>{profile.office?.name || text.noOffice}</ProfileField>}
          {profile.department?.trim() && <ProfileField label={text.department}>{profile.department}</ProfileField>}
          {profile.specialty?.trim() && <ProfileField label={text.specialty}>{profile.specialty}</ProfileField>}
        </dl>
      </section>
      {hasAccountDates && (
        <section aria-label={text.account} className="border-t border-slate-100 p-6 sm:px-8">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">{text.account}</h3>
          <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            {memberSince && <ProfileField label={text.memberSince}>{memberSince}</ProfileField>}
            {lastLogin && <ProfileField label={text.lastLogin}>{lastLogin}</ProfileField>}
          </dl>
        </section>
      )}
      {children}
    </Card>
  );
}
