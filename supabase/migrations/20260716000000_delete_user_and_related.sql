-- Migration: create a secure function to delete a user and all related records
-- Creates: public.delete_user_and_related(_user_id uuid, _actor_id uuid)
-- This function performs deletes inside a single transaction and logs the action.
CREATE OR REPLACE FUNCTION public.delete_user_and_related(_user_id uuid, _actor_id uuid)
RETURNS void AS $$
BEGIN
  -- Ensure profile exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  -- Remove message reactions and messages sent by the user
  DELETE FROM public.message_reactions WHERE user_id = _user_id;
  DELETE FROM public.messages WHERE sender_id = _user_id;

  -- Conversations where user is participant and their messages
  DELETE FROM public.messages WHERE conversation_id IN (
    SELECT id FROM public.conversations WHERE advertiser_id = _user_id OR creator_id = _user_id
  );
  DELETE FROM public.conversations WHERE advertiser_id = _user_id OR creator_id = _user_id;

  -- Portfolio & related media references
  DELETE FROM public.portfolio WHERE creator_id = _user_id;

  -- Delete media files owned by user
  DELETE FROM public.media_files WHERE owner_id = _user_id;

  -- Applications, contracts and related rows where user is creator or advertiser
  DELETE FROM public.applications WHERE creator_id = _user_id;
  DELETE FROM public.contracts WHERE creator_id = _user_id OR advertiser_id = _user_id;

  -- Payments where user is payer or payee and related payment logs
  DELETE FROM public.payment_logs WHERE actor_id = _user_id;
  DELETE FROM public.payments WHERE payer_id = _user_id OR payee_id = _user_id;

  -- Campaigns and their summaries owned by advertiser
  DELETE FROM public.campaign_payment_summary WHERE campaign_id IN (
    SELECT id FROM public.campaigns WHERE advertiser_id = _user_id
  );
  DELETE FROM public.campaigns WHERE advertiser_id = _user_id;

  -- Notifications, saved items, roles, profiles, wallets, withdrawals and payout methods
  DELETE FROM public.notifications WHERE user_id = _user_id;
  DELETE FROM public.saved_campaigns WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.creator_profiles WHERE user_id = _user_id;
  DELETE FROM public.advertiser_profiles WHERE user_id = _user_id;
  DELETE FROM public.payout_methods WHERE user_id = _user_id;
  DELETE FROM public.withdrawals WHERE user_id = _user_id;
  DELETE FROM public.wallets WHERE user_id = _user_id;

  -- Activity logs and other audit rows referencing the user
  DELETE FROM public.activity_logs WHERE user_id = _user_id OR entity_id = _user_id;

  -- Reports, reviews, saved creators and creators saved by users
  DELETE FROM public.reports WHERE reporter_id = _user_id OR resolver_id = _user_id;
  DELETE FROM public.reviews WHERE reviewee_id = _user_id OR reviewer_id = _user_id;
  DELETE FROM public.saved_creators WHERE creator_id = _user_id OR user_id = _user_id;

  -- Social accounts, support tickets and verification requests
  DELETE FROM public.social_accounts WHERE user_id = _user_id;
  DELETE FROM public.support_tickets WHERE assignee_id = _user_id OR user_id = _user_id;
  DELETE FROM public.verification_requests WHERE reviewer_id = _user_id OR user_id = _user_id;

  -- Transactions / wallet logs referencing user
  DELETE FROM public.transactions WHERE user_id = _user_id OR created_by = _user_id OR updated_by = _user_id;
  DELETE FROM public.wallet_transactions WHERE user_id = _user_id OR created_by = _user_id OR updated_by = _user_id;

  -- Refunds and withdrawal logs that reference the user
  DELETE FROM public.refunds WHERE created_by = _user_id OR requested_by = _user_id OR reviewed_by = _user_id OR updated_by = _user_id;
  DELETE FROM public.withdrawal_logs WHERE admin_id = _user_id;

  -- Misc tables that may reference the profile by several column names
  DELETE FROM public.message_reactions WHERE user_id = _user_id;
  DELETE FROM public.message_reactions WHERE user_id IS NULL; -- noop, defensive

  -- Finally remove the profile row
  DELETE FROM public.profiles WHERE id = _user_id;

  -- Delete the underlying auth user
  DELETE FROM auth.users WHERE id = _user_id;

  -- Insert an audit record for the deletion
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (_actor_id, 'user.deleted', 'profile', _user_id, json_build_object('deleted_user', _user_id));

EXCEPTION
  WHEN OTHERS THEN
    -- Bubble up error so caller (and client) can detect failure — transaction will be rolled back
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
