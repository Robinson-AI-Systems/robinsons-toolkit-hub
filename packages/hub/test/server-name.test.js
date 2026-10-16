import {it,expect} from 'vitest';
import {serverNamePattern} from '../src/server-name.js';
import {brokerCatalog} from '../src/broker.js';

it('accepts real RTC manifest service IDs, but no routes, dots or unsafe delimiters',()=>{
 for(const name of ['google-workspace-mcp','stripe-mcp','github-mcp',
  'stripe','google_workspace','a_','a2','a'.repeat(60)])
  expect(serverNamePattern.test(name),name).toBe(true);
 for(const name of ['a','', 'A-service','-bad','bad-','bad/name','bad.name',
  'bad%2Fname','bad:service','bad service','a'.repeat(61)])
  expect(serverNamePattern.test(name),name).toBe(false);
});

it('advertises hyphenated server selection while preserving underscore-only RTC tools',()=>{
 const catalog=brokerCatalog();
 const search=catalog.find(x=>x.name==='hub_search_tools').inputSchema.properties;
 expect(new RegExp(search.server.pattern).test('google-workspace-mcp')).toBe(true);
 expect(new RegExp(search.server.pattern).test('bad/name')).toBe(false);
 expect(new RegExp(search.area.pattern).test('drive')).toBe(true);
 expect(new RegExp(search.area.pattern).test('bad-area')).toBe(false);
 const call=catalog.find(x=>x.name==='hub_call').inputSchema.properties;
 expect(new RegExp(call.name.pattern).test('workspace_drive_list')).toBe(true);
 expect(new RegExp(call.name.pattern).test('workspace-drive-list')).toBe(false);
});
