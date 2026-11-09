import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = await readFile(new URL('./verify-pro-independence.mjs', import.meta.url), 'utf8');
const helper = source.slice(source.indexOf('function hrefs('), source.indexOf('async function checkConfiguredLinks('));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const paths = ['/recruit/sapporo/', '/recruit/yokohama/'];
function fixtures() {
  const pages = {
    '/recruit-contact.js': "const SAPPORO='/recruit/sapporo/'; const YOKOHAMA='/recruit/yokohama/'; href=\"${SAPPORO}\" href=\"${YOKOHAMA}\"",
    '/recruit/': paths.map(path => `<a href="${path}">Job</a>`).join(''),
  };
  for (const [index, path] of paths.entries()) {
    const phone = index === 1 ? '0459303366' : '0113748012';
    const target = index === 1 ? 'https://jp.indeed.com/jobs?q=株式会社吏央&amp;l=神奈川県横浜市' : 'https://jp.indeed.com/viewjob?jk=0123456789abcdef';
    pages[path] = `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', hiringOrganization: { name: '株式会社吏央' }, jobLocation: { address: { addressRegion: index === 1 ? '神奈川県' : '北海道' } }, url: `https://rio-works.com${path}`, identifier: { value: '0123456789abcdef' }, baseSalary: { value: { minValue: 11000, maxValue: 15000, unitText: 'DAY' } } })}</script><section id="apply"><a href="${target}">応募</a><a href="tel:${phone}">電話</a></section>`;
  }
  for (const path of ['/recruit/sapporo-entry/', '/recruit/sapporo-experienced/']) {
    pages[path] = '<link rel="canonical" href="https://rio-works.com/recruit/sapporo/"><meta http-equiv="refresh" content="0;url=/recruit/sapporo/"><a href="/recruit/sapporo/">Moved</a>';
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
  assert.equal(result.evidence.external[1].kind, 'search-results');
  assert.equal(result.evidence.external[1].status, 'NOT_VERIFIED');
});
for (const [name, mutate] of [
  ['missing listing route', p => { p['/recruit/'] = ''; }],
  ['missing detail page', p => { delete p[paths[0]]; }],
  ['wrong office phone', p => { p[paths[1]] = p[paths[1]].replace('tel:0459303366', 'tel:0113748012'); }],
  ['mismatched job ID', p => { p[paths[0]] = p[paths[0]].replace('jk=0123456789abcdef', 'jk=ffffffffffffffff'); }],
  ['wrong search region', p => { p[paths[1]] = p[paths[1]].replace('l=神奈川県横浜市', 'l=北海道札幌市'); }],
]) test(`rejects ${name}`, async () => {
  const pages = fixtures(); mutate(pages);
  assert.equal((await audit(pages)).ok, false);
});

test('accepts the distinct Yokohama AirWork/Indeed association', async () => {
  const pages = fixtures();
  pages[paths[1]] = pages[paths[1]].replace('https://jp.indeed.com/jobs?q=株式会社吏央&amp;l=神奈川県横浜市', 'https://jp.indeed.com/viewjob?jk=781dac6412229d3f').replace('0123456789abcdef', '6037094');
  const result = await audit(pages);
  assert.equal(result.ok, true);
  assert.equal(result.evidence.pages[1].identifierProvider, 'AirWork');
  assert.equal(result.evidence.external[1].status, 'NOT_VERIFIED');
  for (const [from, to] of [['6037094', '9999999'], ['781dac6412229d3f', 'ffffffffffffffff']]) {
    assert.equal((await audit({ ...pages, [paths[1]]: pages[paths[1]].replace(from, to) })).ok, false);
  }
});
for (const [name, mutate] of [
  ['old home route', p => { p['/recruit-contact.js'] = p['/recruit-contact.js'].replace("SAPPORO='/recruit/sapporo/'", "SAPPORO='/recruit/'"); }],
  ['missing legacy page', p => { delete p['/recruit/sapporo-entry/']; }],
  ['wrong legacy destination', p => { p['/recruit/sapporo-experienced/'] = p['/recruit/sapporo-experienced/'].replace('0;url=/recruit/sapporo/', '0;url=/recruit/yokohama/'); }],
  ['legacy redirect loop', p => { p['/recruit/sapporo-entry/'] = p['/recruit/sapporo-entry/'].replace('0;url=/recruit/sapporo/', '0;url=/recruit/sapporo-entry/'); }],
  ['wrong legacy canonical', p => { p['/recruit/sapporo-entry/'] = p['/recruit/sapporo-entry/'].replace('https://rio-works.com/recruit/sapporo/', 'https://rio-works.com/recruit/yokohama/'); }],
  ['missing legacy fallback', p => { p['/recruit/sapporo-entry/'] = p['/recruit/sapporo-entry/'].replace('<a href="/recruit/sapporo/">Moved</a>', ''); }],
  ['wrong employer', p => { p[paths[0]] = p[paths[0]].replace('株式会社吏央', '別会社'); }],
  ['wrong region', p => { p[paths[0]] = p[paths[0]].replace('北海道', '神奈川県'); }],
  ['wrong canonical job URL', p => { p[paths[0]] = p[paths[0]].replace('https://rio-works.com/recruit/sapporo/', 'https://rio-works.com/recruit/yokohama/'); }],
  ['expired posting', p => { p[paths[0]] = p[paths[0]].replace('"@type":"JobPosting"', '"@type":"JobPosting","validThrough":"2000-01-01"'); }],
  ['invalid expiry', p => { p[paths[0]] = p[paths[0]].replace('"@type":"JobPosting"', '"@type":"JobPosting","validThrough":"invalid"'); }],
  ['missing apply section', p => { p[paths[0]] = p[paths[0]].replace('id="apply"', 'id="other"'); }],
  ['malformed job key', p => { p[paths[0]] = p[paths[0]].replace('jk=0123456789abcdef', 'jk=bad'); }],
]) test(`rejects ${name}`, async () => {
  const pages = fixtures(); mutate(pages);
  assert.equal((await audit(pages)).ok, false);
});

const externalHelper = source.slice(source.indexOf('async function checkExternalRecruitmentDestinations('), source.indexOf('await Promise.all(['));
async function externalAudit(fetchText, yokohama = false) {
  const configured = await audit(fixtures());
  if (yokohama) {
    configured.evidence.external = [{ ...configured.evidence.external[0], page: paths[1] }];
  }
  const results = [{ id: configured.id, evidence: configured.evidence }];
  const checks = [];
  await new AsyncFunction('fetchText', 'results', 'record', `${externalHelper}\nawait checkExternalRecruitmentDestinations();`)(fetchText, results,
    (id, ok, evidence) => checks.push({ id, ok, evidence }));
  return { target: configured.evidence.external[0], checks };
}
test('blocked Indeed responses remain unverified, not PASS', async () => {
  const result = await externalAudit(async () => { throw new Error('HTTP 401'); });
  assert.equal(result.target.status, 'NOT_VERIFIED');
  assert.match(result.target.note, /401/);
  assert.equal(result.checks.length, 0);
});
test('unstructured Indeed responses remain unverified', async () => {
  const result = await externalAudit(async () => ({ response: { status: 200 }, body: '<html>Challenge</html>' }));
  assert.equal(result.target.status, 'NOT_VERIFIED');
  assert.equal(result.checks.length, 0);
});

for (const [name, employer, region, salary, expected, yokohama] of [
  ['matching Sapporo', '株式会社 吏央', '北海道', { minValue: 11000, maxValue: 15000, unitText: 'DAY' }, true, false],
  ['matching Yokohama branch', '株式会社吏央 横浜支店', '神奈川県', { minValue: 11000, maxValue: 15000, unitText: 'DAY' }, true, true],
  ['wrong employer', '別会社', '北海道', { minValue: 11000, maxValue: 15000, unitText: 'DAY' }, false, false],
  ['wrong branch for Sapporo', '株式会社吏央 横浜支店', '北海道', { minValue: 11000, maxValue: 15000, unitText: 'DAY' }, false, false],
  ['wrong region', '株式会社吏央', '神奈川県', { minValue: 11000, maxValue: 15000, unitText: 'DAY' }, false, false],
  ['wrong salary', '株式会社吏央', '北海道', { minValue: 10000, maxValue: 15000, unitText: 'DAY' }, false, false],
  ['missing salary', '株式会社吏央', '北海道', undefined, false, false],
]) test(`live verification: ${name}`, async () => {
  const body = `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', hiringOrganization: { name: employer }, jobLocation: { address: { addressRegion: region } }, baseSalary: { value: salary } })}</script>`;
  const result = await externalAudit(async () => ({ response: { status: 200 }, body }), yokohama);
  assert.equal(result.checks[0].ok, expected);
  assert.equal(result.target.status, expected ? 'PASS' : 'FAIL');
});
