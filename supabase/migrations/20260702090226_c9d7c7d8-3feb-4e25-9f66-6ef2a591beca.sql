
-- Extend enums for the full marketplace payment workflow
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'held';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'released';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'revision_requested';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'withdrawal_requested';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refund_pending';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'paid';

ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'campaign_payment';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_success';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'campaign_funded';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'creator_accepted';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deliverables_uploaded';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'revision_requested';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_released';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_completed';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'refund_completed';

ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'revision_requested';
ALTER TYPE contract_status ADD VALUE IF NOT EXISTS 'approved';

ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE withdrawal_status ADD VALUE IF NOT EXISTS 'rejected';
