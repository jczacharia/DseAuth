#!/usr/bin/env node
// Expand the local azure-pipelines.yml via ADO's pipeline `preview` endpoint — no commit, no run.
// previewRun:true = compile only (nothing queued); yamlOverride = use the file on disk instead of the
// committed one, so local edits compile against the real server-side enterprise templates. Writes the
// returned finalYaml into the gitignored .ado-preview/. Needs ADO_PAT; set ADO_INSECURE=1 if Node
// doesn't trust the corp CA.

import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = process.env.ADO_HOST ?? 'https://tfd.pncint.net';
const COLLECTION = process.env.ADO_COLLECTION ?? 'SharedCollection01';
const PROJECT = process.env.ADO_PROJECT ?? 'DSE - Discoverability';
const PIPELINE_ID = process.env.ADO_PIPELINE_ID ?? '3030';
const API = process.env.ADO_API_VERSION ?? '7.1-preview.1';

const pat = process.env.ADO_PAT;
if (!pat) {
  console.error('!! ADO_PAT not set');
  process.exit(1);
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const yamlOverride = readFileSync(join(ROOT, 'azure-pipelines.yml'), 'utf8');
const url = `${HOST}/${COLLECTION}/${encodeURIComponent(PROJECT)}/_apis/pipelines/${PIPELINE_ID}/preview?api-version=${API}`;

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Basic ' + Buffer.from(`:${pat}`).toString('base64'),
  },
  body: JSON.stringify({previewRun: true, yamlOverride}),
}).catch((e) => {
  const tls = /certificate|self-signed/i.test(e.cause?.message ?? '');
  console.error(
    `!! request failed: ${e.cause?.message ?? e.message}${tls ? '\n   (corp CA? retry with ADO_INSECURE=1)' : ''}`,
  );
  process.exit(1);
});

const data = await res.json().catch(() => null);
// A bad edit returns HTTP 400 with the compile error — that diagnostic is the point, so surface it.
if (!res.ok || !data?.finalYaml) {
  console.error(`!! preview failed (HTTP ${res.status})\n${data?.message ?? JSON.stringify(data)}`);
  process.exit(1);
}

mkdirSync(join(ROOT, '.ado-preview'), {recursive: true});
const out = join(ROOT, '.ado-preview', 'azure-pipelines.expanded.yml');
writeFileSync(out, data.finalYaml);
console.log(`-> ${out} (${data.finalYaml.length} bytes)`);
