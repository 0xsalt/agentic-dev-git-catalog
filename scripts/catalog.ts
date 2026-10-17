export const statuses = ['self-declared-entry','competition-project','preparation','candidate','not-entered','unresolved'] as const;
export type Status = typeof statuses[number];
export interface Project {
 repo:string; summary:string; status:Status; statusNote:string;
 evidence:{url:string;note:string}[];
 firstDiscoveredAt:string;lastObservedAt:string;defaultBranch:string|null;observedSha:string|null;
 availability:'public'|'unavailable'|'unknown'; availabilityCheckedAt?:string;
 license:{spdx:string|null;verifiedAt:string|null;checkedAt?:string;checkedSha?:string;status?:'identified'|'not-found'|'unavailable'|'review-required';sourceUrl?:string;blobSha?:string;note?:string};observationNote:string;
}
export interface Catalog {schemaVersion:1;updatedAt:string;projects:Project[]}
const object = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
function requireString(v:unknown,name:string,max=3000):asserts v is string {
 if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('Invalid '+name);
}
function requireDate(v:unknown,name:string){requireString(v,name,100);if(!Number.isFinite(Date.parse(v)))throw Error('Invalid '+name);}
export function validateCatalog(value:unknown):Catalog {
 if(!object(value)||value.schemaVersion!==1||!Array.isArray(value.projects))throw Error('Invalid catalog schema');
 requireDate(value.updatedAt,'updatedAt');const seen=new Set<string>();
 for(const p of value.projects){
  if(!object(p))throw Error('Invalid project');
  requireString(p.repo,'repo',140);
  if(!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/.test(p.repo)||p.repo.split('/')[1]==='.'||p.repo.split('/')[1]==='..')throw Error('Invalid repo');
  const key=p.repo.toLowerCase();if(seen.has(key))throw Error('Duplicate repo '+p.repo);seen.add(key);
  requireString(p.summary,'summary');requireString(p.statusNote,'statusNote');
  if(!statuses.includes(p.status as Status))throw Error('Invalid status');
  requireDate(p.firstDiscoveredAt,'firstDiscoveredAt');requireDate(p.lastObservedAt,'lastObservedAt');
  if(p.availabilityCheckedAt!==undefined)requireDate(p.availabilityCheckedAt,'availabilityCheckedAt');
  if(p.defaultBranch!==null)requireString(p.defaultBranch,'defaultBranch',255);
  if(p.observedSha!==null&&(typeof p.observedSha!=='string'||!(/^[a-f0-9]{40}$/).test(p.observedSha)))throw Error('Invalid observedSha');
  if(!['public','unavailable','unknown'].includes(p.availability as string))throw Error('Invalid availability');
  if(!object(p.license))throw Error('Invalid license');
  if(p.license.spdx!==null)requireString(p.license.spdx,'license.spdx',100);
  if(p.license.verifiedAt!==null)requireDate(p.license.verifiedAt,'license.verifiedAt');
  if(p.license.checkedAt!==undefined)requireDate(p.license.checkedAt,'license.checkedAt');
  if(p.license.checkedSha!==undefined&&p.license.checkedSha!==p.observedSha)throw Error('License check belongs to another revision');
  if(p.license.status!==undefined&&!['identified','not-found','unavailable','review-required'].includes(p.license.status as string))throw Error('Invalid license status');
  if(p.license.sourceUrl!==undefined){
   requireString(p.license.sourceUrl,'license.sourceUrl');const u=new URL(p.license.sourceUrl as string);
   if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid license source URL');
  }
  if(p.license.blobSha!==undefined&&(typeof p.license.blobSha!=='string'||!(/^[a-f0-9]{40}$/).test(p.license.blobSha)))throw Error('Invalid license blob SHA');
  if(p.license.note!==undefined)requireString(p.license.note,'license.note');
  requireString(p.observationNote,'observationNote');
  if(!Array.isArray(p.evidence)||!p.evidence.length)throw Error('Missing evidence');
  for(const e of p.evidence){
   if(!object(e))throw Error('Invalid evidence');requireString(e.url,'evidence URL');requireString(e.note,'evidence note');
   const u=new URL(e.url as string);if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid evidence URL');
  }
 }
 return value as unknown as Catalog;
}
export function escapeCell(s:string):string {
 return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ').replace(/([\[\]*_`])/g,'\\$1');
}
const categoryGroups: {status:Status;title:string}[] = [
 {status:'self-declared-entry',title:'Self-declared submissions'},
 {status:'competition-project',title:'Competition projects'},
 {status:'preparation',title:'Preparation projects'},
 {status:'candidate',title:'Unconfirmed candidates'},
 {status:'unresolved',title:'Participation unresolved'},
 {status:'not-entered',title:'Explicit non-entries'}
];
function markdownUrl(url:string):string {
 return url.replace(/[()[\]|<>\\\s]/g,ch=>encodeURIComponent(ch).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase()));
}
function licenseLabel(p:Project):string {
 if(p.license.verifiedAt&&p.license.spdx)return p.license.spdx;
 if(p.license.status==='not-found')return 'No project license found';
 if(p.license.status==='unavailable')return 'Source unavailable';
 if(p.license.status==='review-required')return 'License needs review';
 return 'license unverified';
}
export function renderReadme(c:Catalog):string {
 const lines=[
 '# Agentic development Git catalog','',
 'Total projects: '+c.projects.length+'.','',
 'An independent directory of projects associated with Cloudflare’s October 2026 Git platform competition.','',
 'Self-declared submissions require an author statement identifying the project as an entry or submitted work. Organizer receipt and acceptance remain unverified. Projects with weaker evidence appear in separate categories.','',
 'Each category is grouped by license, then sorted by repository name. Descriptions summarize authors’ design claims. Read [catalog.json](catalog.json) for sources, corrections, and demo limitations.','',
 'Metadata updated '+c.updatedAt+'. [Status definitions and maintenance](MAINTENANCE.md).','',
 '| Category | Projects |','|---|---:|'
 ];
 for(const group of categoryGroups){
  const count=c.projects.filter(p=>p.status===group.status).length;
  if(count)lines.push('| ['+group.title+'](#category-'+group.status+') | '+count+' |');
 }
 let index=0;
 for(const group of categoryGroups){
  const projects=c.projects.filter(p=>p.status===group.status);
  if(!projects.length)continue;
  lines.push('','<a id="category-'+group.status+'"></a>','','## '+group.title+' ('+projects.length+')','');
  const labels=[...new Set(projects.map(licenseLabel))].sort((a,b)=>{
   const known=(label:string)=>projects.some(p=>licenseLabel(p)===label&&!!p.license.verifiedAt&&!!p.license.spdx);
   return Number(known(b))-Number(known(a))||a.localeCompare(b);
  });
  for(const label of labels){
   const entries=projects.filter(p=>licenseLabel(p)===label).sort((a,b)=>a.repo.toLowerCase().localeCompare(b.repo.toLowerCase()));
   lines.push('### '+escapeCell(label)+' ('+entries.length+')','','| # | Project | Description | Competition evidence | Observed source | License |','|---:|---|---|---|---|---|');
   for(const p of entries){
    const repoUrl='https://github.com/'+p.repo;
    const source=p.observedSha?'[ZIP at '+p.observedSha.slice(0,10)+']('+repoUrl+'/archive/'+p.observedSha+'.zip)':'Revision unavailable';
    const license=p.license.sourceUrl?'['+escapeCell(label)+']('+markdownUrl(p.license.sourceUrl)+')':escapeCell(label);
    const state=p.availability==='unavailable'?'Unavailable; ':'';
    const evidence=state+'[evidence]('+markdownUrl(p.evidence[0].url)+')';
    lines.push('| '+(++index)+' | ['+p.repo+']('+repoUrl+') | '+escapeCell(p.summary)+' | '+evidence+' | '+source+' | '+license+' |');
   }
   lines.push('');
  }
 }
 lines.push('Observed revisions record earlier checks. Upstream availability can change. A 404 can mean deletion, privatization, or renaming.','','License labels describe the inspected project declaration at the recorded revision. They do not classify every dependency or bundled asset. Check the source before redistribution.','','This is a community catalog, independent of Cloudflare. Catalog tooling uses the MIT license. Each upstream project retains its own license.','');
 return lines.join('\n');
}

