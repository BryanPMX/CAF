"use client";

import { useState, type ReactNode } from "react";
import { Avatar } from "antd";
import {
  ApartmentOutlined,
  IdcardOutlined,
  MailOutlined,
  SafetyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import AuthAvatar from "@/app/(dashboard)/components/AuthAvatar";
import {
  formatProfileDate,
  getProfileInitials,
  getProfileName,
  type UserProfile,
} from "@/app/lib/profile";
import { canAccessAllOffices, getRoleDisplayName } from "@/config/roles";
import { PROFILE_TEXT as text } from "@/config/profile";
import styles from "./ProfileLayout.module.css";

function ProfileField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}
function ProfileSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <span aria-hidden="true" className={styles.sectionIcon}>
          {icon}
        </span>
        {title}
      </h3>
      <dl className={styles.fields}>{children}</dl>
    </section>
  );
}
function ProfileAvatar({
  profile,
  avatarUrl,
}: {
  profile: UserProfile;
  avatarUrl?: string;
}) {
  const [failedURL, setFailedURL] = useState<string | null>(null);
  const initials = getProfileInitials(profile);
  if (avatarUrl && failedURL !== avatarUrl) {
    return (
      <AuthAvatar
        avatarUrl={avatarUrl}
        alt={getProfileName(profile)}
        size={88}
        onError={() => setFailedURL(avatarUrl)}
      />
    );
  }
  return (
    <Avatar
      size={88}
      style={{
        background: "#d9f2ed",
        color: "#164d51",
        fontSize: 28,
        fontWeight: 600,
      }}
      icon={!initials ? <UserOutlined /> : undefined}
    >
      {initials || null}
    </Avatar>
  );
}

export default function ProfileCard({
  profile,
  avatarUrl,
  photoEditor,
  children,
}: {
  profile: UserProfile;
  avatarUrl?: string;
  photoEditor?: ReactNode;
  children?: ReactNode;
}) {
  const memberSince = formatProfileDate(profile.createdAt);
  const lastLogin = formatProfileDate(profile.lastLogin, true);
  const global = canAccessAllOffices(profile.role);
  const hasOffice =
    !global && (profile.role !== "client" || Boolean(profile.officeId));
  const organization = profile.organizationInfo;
  const hasOrganization =
    hasOffice || organization?.department || organization?.specialty;
  return (
    <div className={styles.grid}>
      <aside className={styles.identity} aria-label={text.identity}>
        <div className={styles.identityBody}>
          <p className={styles.eyebrow}>{text.identity}</p>
          <div className={styles.avatar}>
            <ProfileAvatar profile={profile} avatarUrl={avatarUrl} />
          </div>
          <h2 className={styles.name}>
            {getProfileName(profile) || text.fallbackName}
          </h2>
          <div className={styles.badges}>
            <span className={styles.role}>
              {getRoleDisplayName(profile.role)}
            </span>
            {typeof profile.isActive === "boolean" && (
              <span className={styles.status}>
                <span
                  aria-hidden="true"
                  className={`${styles.dot} ${profile.isActive ? "" : styles.inactive}`}
                />
                {profile.isActive ? text.active : text.inactive}
              </span>
            )}
          </div>
          <p className={styles.scope}>
            <SafetyOutlined aria-hidden="true" />
            {global
              ? text.globalScope
              : profile.role === "client"
                ? text.clientScope
                : text.officeScope}
          </p>
        </div>
        {photoEditor && <div className={styles.photo}>{photoEditor}</div>}
      </aside>
      <div className={styles.details}>
        <div
          role="region"
          aria-label={text.contact}
          className={styles.contactGroup}
        >
          <ProfileSection title={text.contactDetails} icon={<MailOutlined />}>
            <ProfileField label={text.email}>
              {profile.email || text.missing}
            </ProfileField>
            <ProfileField label={text.phone}>
              {profile.phone?.trim() || text.missing}
            </ProfileField>
          </ProfileSection>
          {hasOrganization && (
            <ProfileSection
              title={text.organization}
              icon={<ApartmentOutlined />}
            >
              {hasOffice && (
                <ProfileField label={text.office}>
                  {profile.office?.name || text.noOffice}
                </ProfileField>
              )}
              {organization?.department && (
                <ProfileField label={text.department}>
                  {organization.department}
                </ProfileField>
              )}
              {organization?.specialty && (
                <ProfileField label={text.specialty}>
                  {organization.specialty}
                </ProfileField>
              )}
            </ProfileSection>
          )}
        </div>
        {(memberSince || lastLogin) && (
          <ProfileSection title={text.account} icon={<IdcardOutlined />}>
            {memberSince && (
              <ProfileField label={text.memberSince}>
                {memberSince}
              </ProfileField>
            )}
            {lastLogin && (
              <ProfileField label={text.lastLogin}>{lastLogin}</ProfileField>
            )}
          </ProfileSection>
        )}
        {children}
      </div>
    </div>
  );
}
