// Node 20+; executes the handoff collection against an explicitly selected test environment.
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const base = process.env.INVITATION_API_BASE_URL;
  const vars = { hostToken: process.env.INVITATION_HOST_TOKEN, recipientToken: process.env.INVITATION_RECIPIENT_TOKEN,
    tripId: process.env.INVITATION_TRIP_ID, recipientEmail: process.env.INVITATION_RECIPIENT_EMAIL };
  if (!base || Object.values(vars).some(v => !v)) throw new Error('Missing required INVITATION_* environment variables; see M4 README.');
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid API base URL');
  if (process.env.INVITATION_SMOKE_ALLOW_MUTATIONS !== 'true') throw new Error('Set INVITATION_SMOKE_ALLOW_MUTATIONS=true for the dedicated test trip.');
  const steps = JSON.parse(fs.readFileSync(path.join(__dirname, '../contracts/private-invitations/requests.json'), 'utf8'));
  const evidence = [];
  const render = value => typeof value === 'string' ? value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (vars[key] === undefined) throw new Error(`Unknown variable ${key}`); return vars[key];
  }) : value;
  for (const step of steps) {
    if (step.waitMs) { await new Promise(r => setTimeout(r, step.waitMs)); continue; }
    if (step.newKey) vars.key = require('node:crypto').randomUUID();
    if (step.expireSoon) vars.expiresAt = new Date(Date.now() + 2000).toISOString();
    const headers = { Authorization: `Bearer ${vars[step.actor + 'Token']}`, 'Content-Type': 'application/json' };
    if (step.key) headers['Idempotency-Key'] = vars.key;
    const body = step.body ? Object.fromEntries(Object.entries(step.body).map(([k,v]) => [k,render(v)])) : undefined;
    const response = await fetch(base.replace(/\/$/,'') + render(step.path), { method: step.method, headers,
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (response.status !== step.status) throw new Error(`${step.name}: expected ${step.status}, got ${response.status} (${data.error?.code ?? 'no code'})`);
    const at = key => key.split('.').reduce((v,k) => v?.[k],data);
    for (const [key,value] of Object.entries(step.expect || {})) if (at(key) !== value) throw new Error(`${step.name}: unexpected ${key}`);
    for (const [key,value] of Object.entries(step.headers || {})) if (response.headers.get(key) !== value) throw new Error(`${step.name}: unexpected header ${key}`);
    for (const [key,field] of Object.entries(step.capture || {})) vars[key] = at(field);
    // Response bodies contain only synthetic fixture data when exported by the automated test.
    evidence.push({ name: step.name, status: response.status, body: data });
    console.log(`PASS ${step.name}`);
  }
  if (process.env.INVITATION_SMOKE_EVIDENCE_FILE) fs.writeFileSync(process.env.INVITATION_SMOKE_EVIDENCE_FILE, JSON.stringify(evidence,null,2)+'\n');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
