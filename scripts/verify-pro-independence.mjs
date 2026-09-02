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

async function checkConfiguredLinks() {
  const rioUrl = 'https://raw.githubusercontent.com/infoworks-jp/rio-corporate-site/main/recruit-contact.js';
  const tsubasaUrl = 'https://raw.githubusercontent.com/infoworks-jp/tubasa-susukino-site/main/index.html';
  try {
    const { body } = await fetchText(rioUrl);
    const links = ['91ce7644bf2afaab', '6342d3c5e932ba44'];
    record('indeed_links_configured', links.every(link => body.includes(link)), {
      source: rioUrl,
      jobKeys: links,
      scope: 'configuration-only; Indeed may block automated live access',
    }, 'configuration');
  } catch (error) {
    record('indeed_links_configured', false, { source: rioUrl, error: String(error) }, 'configuration');
  }
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
]);

const report = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  chatgptProRequired: false,
  overall: results.every(result => result.status === 'PASS') ? 'PASS' : 'FAIL',
  limitations: [
    'Recruitment email delivery is not tested because that would send a real external message.',
    'Indeed is configuration-checked only because its anti-bot layer can reject automated checks.',
    'This verifies availability and wiring, not the semantic correctness of every business-data row.',
  ],
  results,
};

await mkdir(outputDir, { recursive: true });
await writeFile(`${outputDir}/pro-independence-latest.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.overall !== 'PASS') process.exitCode = 1;
