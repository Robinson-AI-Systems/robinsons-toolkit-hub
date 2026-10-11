import { describe, expect, it } from 'vitest';
import { mergeNamespaces } from '../../src/core/registry.js';
import { registry } from '../../src/tools/index.js';
const make = (name) => ({ tools: [{ name }], handlers: { [name]: async () => null } });
describe('tool registry', () => {
  it('registers only the intended safe metadata/audit readers', () => {
    expect(registry.tools.map(t => t.name)).toEqual([
      'stripe_whoami', 'stripe_list_accounts', 'stripe_check_key_permissions', 'stripe_recent_changes',
      'stripe_list_connections', 'stripe_get_result', 'stripe_where_is_setting',
      'stripe_search_tools', 'stripe_describe_tool', 'stripe_call', 'stripe_batch',
      'customer_list','customer_get','customer_search','customer_find',
      'customer_list_payment_methods','customer_get_payment_method',
      'customer_list_balance_transactions','customer_list_tax_ids',
      'customer_create','customer_update','customer_delete',
      'customer_remove_payment_method','customer_set_default_payment_method',
      'customer_add_balance_credit','customer_add_tax_id','customer_delete_tax_id',
      'customer_remove_discount',
      'payment_list','payment_get','payment_search','charge_list','charge_get',
      'charge_search','payment_list_refunds','payment_get_refund','setup_list','setup_get',
      'payment_charge_saved_method','payment_capture','payment_cancel',
      'payment_update','charge_update','payment_create_refund',
      'payment_update_refund','payment_cancel_refund','setup_cancel',
      'checkout_list','checkout_get','checkout_list_line_items',
      'paylink_list','paylink_get','portal_list_configurations','portal_get_configuration',
      'checkout_create_payment_link_for_customer','checkout_create_setup_link',
      'checkout_expire','paylink_create','paylink_update','paylink_deactivate',
      'paylink_activate','portal_create_session','portal_update_configuration',
      'billing_list_subscriptions','billing_get_subscription','billing_search_subscriptions',
      'billing_preview_change','billing_list_items','billing_list_schedules',
      'billing_get_schedule','billing_create_subscription','billing_update_subscription',
      'billing_change_plan','billing_cancel_subscription','billing_undo_cancel',
      'billing_pause_collection','billing_resume_collection',
      'billing_add_item','billing_update_item','billing_remove_item',
      'billing_create_schedule','billing_update_schedule',
      'billing_release_schedule','billing_cancel_schedule',
      'invoice_list','invoice_get','invoice_search','invoice_list_payments','invoice_preview',
      'invoice_create_draft','invoice_update_draft','invoice_add_line',
      'invoice_update_line','invoice_remove_line',
      'invoice_delete_draft','invoice_finalize','invoice_send',
      'invoice_charge_now','invoice_mark_paid_outside_stripe',
      'invoice_void','invoice_mark_uncollectible',
      'creditnote_list','creditnote_get','creditnote_preview',
      'creditnote_create','creditnote_void',
      'dev_seed','dev_list_runs','dev_seed_refund','dev_verify_outcomes',
      'testclock_list','testclock_create','testclock_advance',
      'dev_confirm_seed_ach','dev_connect_readiness',
      'dev_cleanup','dev_reset_test_data',
      'dev_get_checkout_test_url','dev_list_triggers','dev_trigger_event',
      'dev_create_forwarder','dev_list_forwarders','dev_delete_forwarder',
      'dev_forward_events','dev_test_cards','dev_simulate_subscription',
      'money_get_balance','money_list_balance_transactions',
      'money_get_balance_transaction','money_list_payouts','money_get_payout',
      'money_list_payout_transactions','money_list_topups','money_get_topup',
      'money_list_bank_accounts','money_get_payout_schedule',
      'money_update_payout','money_cancel_payout','money_create_payout','money_reverse_payout',
      'money_create_topup','money_cancel_topup',
      'report_list_types','report_list_runs','report_get_run','report_run','money_set_payout_schedule','report_get_result_file','dispute_list','dispute_get','file_list','file_get','file_create_link','file_upload_evidence','dispute_save_evidence','dispute_submit_evidence','dispute_accept',
      'radar_list_fraud_warnings','radar_get_fraud_warning','radar_list_reviews',
      'radar_get_review','radar_list_value_lists','radar_list_list_items',
      'radar_approve_review','radar_create_value_list',
      'radar_delete_value_list','radar_add_list_item','radar_remove_list_item',
      'identity_list_sessions','identity_get_session','identity_create_session',
      'identity_cancel_session','identity_redact_session',
      'event_list','event_get','event_list_undelivered',
      'webhook_list','webhook_get','webhook_add_events','webhook_remove_events','webhook_create','webhook_update','webhook_delete'
    ]);
    expect(registry.tools.filter(t=>t.writes===true)).toHaveLength(92);
    expect(registry.tools.filter(t=>t.writes===true).every(t=>t.writeContract==='defineWrite-v1')).toBe(true);
  });
  it('refuses duplicates across namespaces', () => {
    expect(() => mergeNamespaces([make('stripe_example'), make('stripe_example')])).toThrow(/Duplicate/);
  });
  it('refuses tools without a handler', () => {
    expect(() => mergeNamespaces([{ tools: [{ name: 'broken' }], handlers: {} }])).toThrow(/Missing handler/);
  });
});
