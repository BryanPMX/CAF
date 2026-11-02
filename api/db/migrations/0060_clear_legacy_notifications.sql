-- Migration: 0060_clear_legacy_notifications.sql
-- Description: Reset the notification inbox after replacing legacy CRUD audit
-- notifications with actionable user notifications.
--
-- This is intentionally a one-time data cleanup. Notifications created after
-- this migration remain available through the normal notification workflow.

DELETE FROM notifications;
