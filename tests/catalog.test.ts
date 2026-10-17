import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, renderReadme } from '../scripts/catalog.ts';

const sha = 'a'.repeat(40);
const entry = () => ({repo:'alice/project',summary:'A project | with <markup>',status:'candidate',statusNote:'Not confirmed',evidence:[{url:'https://github.com/alice/project/blob/'+sha+'/README.md',note:'Reported evidence'}],firstDiscoveredAt:'2026-10-17T07:26:00Z',lastObservedAt:'2026-10-17T07:26:00Z',defaultBranch:'main',observedSha:sha,availability:'public',license:{spdx:null,verifiedAt:null},observationNote:'Historical report'});
const catalog = () => ({schemaVersion:1,updatedAt:'2026-10-17T07:26:00Z',projects:[entry()]});
test('rejects traversal, duplicate names, abbreviated hashes and untrusted URL schemes',()=>{
 for(const change of [
  c=>c.projects[0].repo='../escape',
  c=>c.projects.push({...entry(),repo:'ALICE/PROJECT'}),
  c=>c.projects[0].observedSha='abc123',
  c=>c.projects[0].evidence[0].url='javascript:alert(1)',
  c=>c.projects[0].status='accepted-by-organizer',
  c=>c.projects[0].license.sourceUrl='javascript:alert(1)',
  c=>c.projects[0].license.checkedSha='b'.repeat(40)
 ]){const c=catalog();change(c);assert.throws(()=>validateCatalog(c));}
});
test('renderer escapes table content and links directly to upstream',()=>{
 const c=validateCatalog(catalog());const md=renderReadme(c);
 assert.ok(md.includes('https://github.com/alice/project'));
 assert.ok(md.includes('A project \\| with &lt;markup&gt;'));
 assert.ok(!md.includes('<markup>'));
 assert.ok(md.includes('license unverified'));
});
test('evidence URL punctuation cannot introduce another markdown link',()=>{
 const c=catalog();c.projects[0].evidence[0].url='https://example.org/)[injected](https://attacker.example/)';
 const md=renderReadme(validateCatalog(c));assert.ok(!md.includes(')[injected]('));assert.ok(md.includes('%29%5Binjected%5D%28'));
});


test('groups explicit submissions first, then licenses, while numbering the complete catalog',()=>{
 const c=catalog();
 c.projects=[
  {...entry(),repo:'alpha/project',status:'competition-project',license:{spdx:'MIT',verifiedAt:'2026-10-17'}},
  {...entry(),repo:'zulu/project',status:'self-declared-entry',license:{spdx:'MIT',verifiedAt:'2026-10-17'}},
  {...entry(),repo:'beta/project',status:'self-declared-entry',license:{spdx:'Apache-2.0',verifiedAt:'2026-10-17'}}
 ];
 const md=renderReadme(validateCatalog(c));
 assert.ok(md.includes('## Self-declared submissions (2)'));
 assert.ok(md.includes('### Apache-2.0 (1)'));
 assert.ok(md.indexOf('beta/project')<md.indexOf('zulu/project'));
 assert.ok(md.indexOf('zulu/project')<md.indexOf('alpha/project'));
 assert.deepEqual([...md.matchAll(/^\| (\d+) \| \[/gm)].map(m=>Number(m[1])),[1,2,3]);
 assert.ok(md.startsWith('# Agentic development Git catalog\n\nTotal projects: 3.'));
});

