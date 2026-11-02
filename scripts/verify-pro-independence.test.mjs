import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = await readFile(new URL('./verify-pro-independence.mjs', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function hrefs('), source.indexOf('async function checkConfiguredLinks('));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const paths = ['/recruit/sapporo-entry/', '/recruit/sapporo-experienced/', '/recruit/yokohama/'];
function fixtures() {
  const pages = {
    '/recruit-contact.js': "const SAPPORO='/recruit/'; const YOKOHAMA='/recruit/yokohama/'; href=\"${SAPPORO}\" href=\"${YOKOHAMA}\"",
    '/recruit/': paths.map(path => `<a href="${path}">Job</a>`).join(''),
  };
  for (const [index, path] of paths.entries()) {
    const phone = index === 2 ? '0459303366' : '0113748012';
    const target = index === 2 ? 'https://jp.indeed.com/jobs?q=株式会社吏央&amp;l=神奈川県横浜市' : 'https://jp.indeed.com/viewjob?jk=0123456789abcdef';
    pages[path] = `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', hiringOrganization: { name: '株式会社吏央' }, jobLocation: { address: { addressRegion: index === 2 ? '神奈川県' : '北海道' } }, url: `https://rio-works.com${path}`, identifier: { value: '0123456789abcdef' } })}</script><section id="apply"><a href="${target}">応募</a><a href="tel:${phone}">電話</a></section>`;
  }
  return pages;
}
async function audit(pages) {
  let result;
  await new AsyncFunction('fetchText', 'record', `${helper}\nawait checkRecruitmentLinks();`)(async url => {
    const path = new URL(url).pathname;
    if (!(path in pages)) throw new Error('HTTP 404');
    return { body: pages[path], response: { status: 200, url } };
  }, (id, ok, evidence) => { result = { id, ok, evidence }; });
  return result;
}
test('current route graph accepts changing IDs and identifies search-only destinations', async () => {
  const result = await audit(fixtures());
  assert.equal(result.ok, true);
  assert.equal(result.evidence.external[2].kind, 'search-results');
  assert.equal(result.evidence.external[2].status, 'NOT_VERIFIED');
});
for (const [name, mutate] of [
  ['missing listing route', p => { p['/recruit/'] = ''; }],
  ['missing detail page', p => { delete p[paths[0]]; }],
  ['wrong office phone', p => { p[paths[2]] = p[paths[2]].replace('tel:0459303366', 'tel:0113748012'); }],
  ['mismatched job ID', p => { p[paths[0]] = p[paths[0]].replace('jk=0123456789abcdef', 'jk=ffffffffffffffff'); }],
  ['wrong search region', p => { p[paths[2]] = p[paths[2]].replace('l=神奈川県横浜市', 'l=北海道札幌市'); }],
]) test(`rejects ${name}`, async () => {
  const pages = fixtures(); mutate(pages);
  assert.equal((await audit(pages)).ok, false);
});
