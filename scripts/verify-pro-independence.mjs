import { mkdir, writeFile } from 'node:fs/promises';

const outputDir = 'audit-output';
const results = [];

function record(id, ok, evidence, level = 'runtime') {
  results.push({ id, level, status: ok ? 'PASS' : 'FAIL', evidence });
}

async function fetchText(url, init = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    ...init,
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return { response, body };
}

async function checkManifest(id, url, expectedRuntime) {
  try {
    const { body } = await fetchText(url);
    const manifest = JSON.parse(body);
    const ok = manifest.chatgptProRequired === false
      && String(manifest.runtime).includes(expectedRuntime);
    record(id, ok, {
      url,
      repository: manifest.repository,
      runtime: manifest.runtime,
      chatgptProRequired: manifest.chatgptProRequired,
    }, 'configuration');
  } catch (error) {
    record(id, false, { url, error: String(error) }, 'configuration');
  }
}

async function checkPage(id, url, requiredMarkers) {
  try {
    const { response, body } = await fetchText(`${url}?audit=${Date.now()}`);
    const missing = requiredMarkers.filter(marker => !body.includes(marker));
    const forbidden = ['chatgpt.com', 'openai.com', 'oaistatic.com']
      .filter(marker => body.toLowerCase().includes(marker));
    record(id, missing.length === 0 && forbidden.length === 0, {
      url,
      httpStatus: response.status,
      requiredMarkers,
      missingMarkers: missing,
      forbiddenRuntimeReferences: forbidden,
    });
  } catch (error) {
    record(id, false, { url, error: String(error) });
  }
}

async function checkRioContact() {
  const url = 'https://xxhgerxugsjoxkbuuqhb.supabase.co/functions/v1/rio-contact';
  try {
    const { response, body } = await fetchText(url);
    const value = JSON.parse(body);
    record('rio_contact_function_and_database', value.ok === true && value.service === 'rio-contact', {
      url,
      httpStatus: response.status,
      response: value,
      note: 'GET health checks the Edge Function and SELECT 1 against its database. It does not send recruitment email.',
    });
  } catch (error) {
    record('rio_contact_function_and_database', false, { url, error: String(error) });
  }
}

async function checkTsubasaDatabase() {
  const url = 'https://spyopczqtxypqjbhylzf.supabase.co/rest/v1/monthly_summary?select=id&limit=1';
  const publicKey = 'sb_publishable_0OHZyJkYkTjqJoIUGUAKNw_R1ZvEzUg';
  try {
    const { response, body } = await fetchText(url, {
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${publicKey}`,
        'Accept-Profile': 'rev2',
      },
    });
    const value = JSON.parse(body);
    record('tsubasa3_supabase_source_of_truth', Array.isArray(value), {
      url,
      httpStatus: response.status,
      schema: 'rev2',
      table: 'monthly_summary',
      returnedArray: Array.isArray(value),
      note: 'Uses the same public publishable key and schema as the GitHub Pages dashboard.',
    });
  } catch (error) {
    record('tsubasa3_supabase_source_of_truth', false, { url, error: String(error) });
  }
}

function hrefs(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
    .map(match => match[1].replaceAll('&amp;', '&'));
}

async function checkRecruitmentLinks() {
  const origin = 'https://rio-works.com';
  const evidence = { origin, pages: [], redirects: [], external: [], issues: [] };
  try {
    const { body: contact } = await fetchText(`${origin}/recruit-contact.js`);
    for (const [name, path] of [['SAPPORO', '/recruit/sapporo/'], ['YOKOHAMA', '/recruit/yokohama/']]) {
      if (!new RegExp(`const\\s+${name}\\s*=\\s*['"]${path}['"]`).test(contact)
          || !contact.includes('${' + name + '}')) evidence.issues.push(`Missing home recruitment route: ${name}`);
    }
    const { body: listing } = await fetchText(`${origin}/recruit/`);
    const listingLinks = hrefs(listing);
    const jobs = [
      { path: '/recruit/sapporo/', region: '北海道', phone: '0113748012' },
      // Public Yokohama page uses an AirWork identifier, not an Indeed job key.
      // Keep the explicit cross-provider association; never exempt arbitrary numeric IDs.
      { path: '/recruit/yokohama/', region: '神奈川県', phone: '0459303366',
        airWorkId: '6037094', indeedKey: '781dac6412229d3f' },
    ];
    // fetch follows HTTP redirects, but not HTML meta refresh. Verify legacy
    // aliases separately so neither broken bookmarks nor wrong-office redirects pass.
    for (const path of ['/recruit/sapporo-entry/', '/recruit/sapporo-experienced/']) {
      try {
        const { response, body } = await fetchText(`${origin}${path}`);
        const target = `${origin}/recruit/sapporo/`;
        const tags = body.match(/<meta\b[^>]*>/gi) || [];
        const refresh = tags.find(tag => /http-equiv=["']refresh["']/i.test(tag));
        const content = refresh?.match(/content=["']([^"']+)["']/i)?.[1];
        const destination = content?.match(/^\s*0\s*;\s*url\s*=\s*(.+?)\s*$/i)?.[1];
        const canonical = (body.match(/<link\b[^>]*>/gi) || [])
          .find(tag => /rel=["']canonical["']/i.test(tag))?.match(/href=["']([^"']+)["']/i)?.[1];
        const ok = response.url === target || (destination && new URL(destination, origin).href === target
          && canonical === target && hrefs(body).some(link => new URL(link, origin).href === target));
        if (!ok) evidence.issues.push(`Wrong/missing legacy redirect: ${path}`);
        evidence.redirects.push({ url: `${origin}${path}`, finalUrl: response.url,
          target: destination, httpStatus: response.status, ok: Boolean(ok) });
      } catch (error) { evidence.issues.push(`${path}: ${String(error)}`); }
    }
    for (const job of jobs) {
      if (!listingLinks.includes(job.path)) evidence.issues.push(`Missing listing link: ${job.path}`);
      try {
        const url = `${origin}${job.path}`;
        const { response, body } = await fetchText(url);
        const links = hrefs(body);
        const posting = [...body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
          .map(match => JSON.parse(match[1])).find(value => value['@type'] === 'JobPosting');
        if (!posting || posting.hiringOrganization?.name !== '株式会社吏央'
            || posting.jobLocation?.address?.addressRegion !== job.region
            || posting.url !== url) evidence.issues.push(`Wrong job identity/location: ${job.path}`);
        if (posting?.validThrough && (!Number.isFinite(Date.parse(posting.validThrough)) || Date.parse(posting.validThrough) < Date.now())) evidence.issues.push(`Expired posting: ${job.path}`);
        if (!links.includes(`tel:${job.phone}`)) evidence.issues.push(`Wrong/missing application phone: ${job.path}`);
        const applyBox = body.match(/<section\b[^>]*id=["']apply["'][^>]*>([\s\S]*?)<\/section>/i)?.[1] || '';
        const applyLinks = hrefs(applyBox);
        const indeed = links.filter(link => link.startsWith('https://jp.indeed.com/'));
        const unique = [...new Set(indeed)];
        if (unique.length !== 1 || !applyLinks.includes(unique[0]) || !applyLinks.includes(`tel:${job.phone}`)) {
          evidence.issues.push(`Missing/inconsistent application actions: ${job.path}`);
        }
        for (const target of unique) {
          const parsed = new URL(target);
          const direct = parsed.pathname === '/viewjob' && /^[a-f0-9]{16}$/.test(parsed.searchParams.get('jk') || '');
          const search = parsed.pathname === '/jobs' && parsed.searchParams.get('q')?.includes('株式会社吏央')
            && parsed.searchParams.get('l')?.includes(job.region);
          if (!direct && !search) evidence.issues.push(`Invalid application URL: ${job.path}`);
          if (direct) {
            const identifier = posting?.identifier?.value;
            const key = parsed.searchParams.get('jk');
            const matches = job.airWorkId
              ? identifier === job.airWorkId && key === job.indeedKey
              : identifier === key;
            if (!matches) evidence.issues.push(`Job ID differs from configured provider association: ${job.path}`);
          }
          evidence.external.push({ page: job.path, url: target, kind: direct ? 'job-detail' : 'search-results',
            status: 'NOT_VERIFIED', note: search ? 'Search results do not guarantee arrival at an individual job; the office phone is available.' : 'External job availability requires a live check; configuration PASS is not proof of application delivery.' });
        }
        evidence.pages.push({ url, finalUrl: response.url, httpStatus: response.status, title: posting?.title,
          jobIdentifier: posting?.identifier?.value, identifierProvider: job.airWorkId ? 'AirWork' : 'Indeed', salary: posting?.baseSalary?.value, phone: job.phone });
      } catch (error) {
        evidence.issues.push(`${job.path}: ${String(error)}`);
      }
    }
  } catch (error) {
    evidence.issues.push(String(error));
  }
  // Keep the historical check ID for report consumers, but audit the current public route graph.
  record('indeed_links_configured', evidence.issues.length === 0, evidence, 'configuration');
}

async function checkConfiguredLinks() {
  const tsubasaUrl = 'https://raw.githubusercontent.com/infoworks-jp/tubasa-susukino-site/main/index.html';
  try {
    const { body } = await fetchText(tsubasaUrl);
    const hasMapsLink = body.includes('https://www.google.com/maps/search/?api=1&query=');
    const hasApiKey = /maps\.googleapis\.com|key=[A-Za-z0-9_-]{20,}/i.test(body);
    record('google_maps_link_configured', hasMapsLink && !hasApiKey, {
      source: tsubasaUrl,
      standardMapsLink: hasMapsLink,
      googleCloudApiKeyRequired: hasApiKey,
    }, 'configuration');
  } catch (error) {
    record('google_maps_link_configured', false, { source: tsubasaUrl, error: String(error) }, 'configuration');
  }
}

async function checkExternalRecruitmentDestinations() {
  const configured = results.find(item => item.id === 'indeed_links_configured');
  for (const target of configured?.evidence.external || []) {
    if (target.kind !== 'job-detail') continue;
    try {
      const { response, body } = await fetchText(target.url);
      const raw = [...body.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      const posting = raw.map(match => JSON.parse(match[1])).find(value => value['@type'] === 'JobPosting');
      if (!posting) { target.note += ' Live response has no verifiable JobPosting data.'; continue; }
      const expected = configured.evidence.pages.find(page => new URL(page.url).pathname === target.page);
      const actualSalary = posting.baseSalary?.value;
      const allowedEmployers = target.page === '/recruit/yokohama/'
        ? ['株式会社吏央', '株式会社吏央横浜支店'] : ['株式会社吏央'];
      const identityOk = allowedEmployers.includes(posting.hiringOrganization?.name?.replace(/\s/g, ''))
        && posting.jobLocation?.address?.addressRegion === (target.page.includes('sapporo') ? '北海道' : '神奈川県');
      const salaryOk = Number.isFinite(expected.salary?.minValue) && Number.isFinite(expected.salary?.maxValue)
        && typeof expected.salary?.unitText === 'string'
        && expected.salary.minValue === actualSalary?.minValue
        && expected.salary?.maxValue === actualSalary?.maxValue
        && expected.salary?.unitText === actualSalary?.unitText;
      target.status = identityOk && salaryOk ? 'PASS' : 'FAIL';
      record(`recruitment_destination_${target.page.split('/').filter(Boolean).at(-1)}`, identityOk && salaryOk, {
        url: target.url, httpStatus: response.status, title: posting.title,
        employer: posting.hiringOrganization?.name, expectedSalary: expected.salary, actualSalary,
        identityOk, salaryOk, note: 'Read-only content verification; no application was submitted.',
      });
    } catch (error) { target.note += ` Live verification unavailable: ${String(error)}`; }
  }
}

await Promise.all([
  checkManifest(
    'rio_manifest',
    'https://raw.githubusercontent.com/infoworks-jp/rio-corporate-site/main/site-manifest.json',
    'GitHub Pages',
  ),
  checkManifest(
    'tsubasa_site_manifest',
    'https://raw.githubusercontent.com/infoworks-jp/tubasa-susukino-site/main/site-manifest.json',
    'GitHub Pages',
  ),
  checkManifest(
    'tsubasa3_manifest',
    'https://raw.githubusercontent.com/infoworks-jp/tsubasa-business-system-codex/main/site-manifest.json',
    'GitHub Pages',
  ),
  checkPage('rio_public_site', 'https://infoworks-jp.github.io/rio-corporate-site/', ['株式会社吏央']),
  checkPage('tsubasa_public_site', 'https://www.tubasa-susukino.com/', ['味一番つばさ', 'GOOGLE MAP']),
  checkPage('tsubasa3_public_dashboard', 'https://infoworks-jp.github.io/tsubasa-business-system-codex/', [
    'fresh-supabase.js', 'holiday-enhancements.js', 'fl-dashboard.js',
  ]),
  checkRioContact(),
  checkTsubasaDatabase(),
  checkConfiguredLinks(),
  checkRecruitmentLinks(),
]);

await checkExternalRecruitmentDestinations();

const report = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  chatgptProRequired: false,
  overall: results.every(result => result.status === 'PASS') ? 'PASS' : 'FAIL',
  limitations: [
    'Recruitment email delivery is not tested because that would send a real external message.',
    'Indeed responses with JobPosting data are checked for employer, region and salary. Blocked/unstructured responses remain NOT_VERIFIED; search URLs do not guarantee an individual job.',
    'This verifies availability and wiring, not the semantic correctness of every business-data row.',
  ],
  results,
};

await mkdir(outputDir, { recursive: true });
await writeFile(`${outputDir}/pro-independence-latest.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.overall !== 'PASS') process.exitCode = 1;
