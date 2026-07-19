alter table private.media_assets enable row level security;
alter table private.media_assets force row level security;

alter table private.context_snapshots enable row level security;
alter table private.context_snapshots force row level security;

alter table private.media_analysis_runs enable row level security;
alter table private.media_analysis_runs force row level security;

alter table private.media_job_attempts enable row level security;
alter table private.media_job_attempts force row level security;

alter table private.evidence_items enable row level security;
alter table private.evidence_items force row level security;

alter table private.interpretations enable row level security;
alter table private.interpretations force row level security;

alter table private.analysis_reports enable row level security;
alter table private.analysis_reports force row level security;

alter table private.live_events enable row level security;
alter table private.live_events force row level security;

alter table private.confidence_calibrations enable row level security;
alter table private.confidence_calibrations force row level security;

alter table private.partner_referrals enable row level security;
alter table private.partner_referrals force row level security;

alter table private.partner_commission_ledger enable row level security;
alter table private.partner_commission_ledger force row level security;

revoke all on private.media_assets from public, anon, authenticated;
revoke all on private.context_snapshots from public, anon, authenticated;
revoke all on private.media_analysis_runs from public, anon, authenticated;
revoke all on private.media_job_attempts from public, anon, authenticated;
revoke all on private.evidence_items from public, anon, authenticated;
revoke all on private.interpretations from public, anon, authenticated;
revoke all on private.analysis_reports from public, anon, authenticated;
revoke all on private.live_events from public, anon, authenticated;
revoke all on private.confidence_calibrations from public, anon, authenticated;
revoke all on private.partner_referrals from public, anon, authenticated;
revoke all on private.partner_commission_ledger from public, anon, authenticated;

grant all on private.media_assets to service_role;
grant all on private.context_snapshots to service_role;
grant all on private.media_analysis_runs to service_role;
grant all on private.media_job_attempts to service_role;
grant all on private.evidence_items to service_role;
grant all on private.interpretations to service_role;
grant all on private.analysis_reports to service_role;
grant all on private.live_events to service_role;
grant all on private.confidence_calibrations to service_role;
grant all on private.partner_referrals to service_role;
grant all on private.partner_commission_ledger to service_role;
