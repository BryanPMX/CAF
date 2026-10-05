'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getApiConfig } from '@/app/lib/config';

function isAuthenticatedAvatarURL(
  avatarUrl: string | null | undefined,
  apiBaseURL: string,
): boolean {
  if (!avatarUrl) return false;
  try {
    const apiURL = new URL(apiBaseURL);
    const candidate = new URL(avatarUrl, apiURL.origin);
    const path = candidate.pathname.replace(/\/+$/, '');
    return (
      candidate.origin === apiURL.origin &&
      (path === '/api/v1/avatar' || path === '/api/v1/client/avatar')
    );
  } catch {
    return false;
  }
}

/**
 * Renders an img for the user avatar. If avatarUrl is the API avatar endpoint,
 * fetches with auth and displays via blob URL; otherwise uses URL as-is.
 */
export default function AuthAvatar({
  avatarUrl,
  alt = 'Avatar',
  className,
  style,
  size,
  onError,
}: {
  avatarUrl: string | null | undefined;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
  onError?: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  const baseURL = getApiConfig().baseURL;
  const isApiAvatar = isAuthenticatedAvatarURL(avatarUrl, baseURL);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!avatarUrl || !isApiAvatar) return;
    const token = typeof window !== 'undefined' ? (localStorage.getItem('authToken') || localStorage.getItem('token')) : null;
    if (!token) return;
    const fullUrl = avatarUrl.startsWith('http')
      ? avatarUrl
      : `${baseURL.replace(/\/api\/v1\/?$/, '')}${avatarUrl}`;
    let cancelled = false;
    fetch(fullUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Not found'))))
      .then((blob) => {
        if (cancelled) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setImgError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setImgError(true);
        onErrorRef.current?.();
      });
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [avatarUrl, isApiAvatar, baseURL]);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);
  const src = isApiAvatar ? blobUrl : (avatarUrl || null);
  const isLoading = isApiAvatar && !blobUrl;
  const showImg = src && !imgError;

  const handleImgError = () => {
    setImgError(true);
    onError?.();
  };

  if (!src && !isLoading) return null;
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-block',
        overflow: 'hidden',
        background: isLoading ? 'var(--ant-color-fill-tertiary, #f0f0f0)' : undefined,
        ...style,
      }}
    >
      {showImg ? (
        <img
          src={src}
          alt={alt}
          style={{ width: size, height: size, objectFit: 'cover' }}
          onError={handleImgError}
        />
      ) : null}
    </span>
  );
}
