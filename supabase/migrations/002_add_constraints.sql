-- =============================================================
-- Free-Rider Tracker — Phase 5 Migration
-- Run in Supabase Dashboard → SQL Editor after 001_initial_schema.sql
-- =============================================================

-- Add unique constraint on contribution_events so the worker can safely
-- upsert events without creating duplicates on retry (idempotent ingestion).
-- raw_ref is the provider's native event ID (commit SHA, version ID, revision ID).
alter table public.contribution_events
  add constraint contribution_events_unique_event
  unique (group_id, provider, raw_ref);
