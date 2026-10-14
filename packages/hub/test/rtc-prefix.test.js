import {it,expect} from 'vitest';
import {ownsRtcToolName} from '../src/rtc-prefix.js';

it('matches canonical bare and already-delimited RTC prefixes, including nested owners',()=>{
 expect(ownsRtcToolName('stripe','stripe_invoice_list')).toBe(true);
 expect(ownsRtcToolName('workspace_','workspace_drive_list')).toBe(true);
 expect(ownsRtcToolName('foo_bar','foo_bar_status')).toBe(true);
 expect(ownsRtcToolName('foo','foo_bar_status')).toBe(true);
 for(const [prefix,name] of [
  ['workspace_','workspace__drive_list'],['stripe','stripe__invoice_list'],
  ['workspace_','workspace_'],['workspace_','workspace2_drive_list'],
  ['stripe','stripe'],['stripe','striper_invoice_list'],
  ['','stripe_invoice_list'],['workspace/','workspace_drive_list'],
  ['workspace_',null],['workspace_',{}]
 ])expect(ownsRtcToolName(prefix,name)).toBe(false);
});
