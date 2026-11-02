import { redirect } from 'next/navigation';

/**
 * Keep legacy admin bookmarks functional while maintaining one dashboard
 * implementation for every portal role.
 */
export default function LegacyAdminDashboardRedirect() {
  redirect('/');
}
