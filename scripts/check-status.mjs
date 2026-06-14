import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const root = path.resolve(import.meta.dirname, '..');
const statusFile = path.join(root, 'data', 'status.json');
const incidentFile = path.join(root, 'data', 'incidents.json');
const baseUrl = (process.env.S9LAB_BACKEND_URL || 'http://31.70.89.55:25614').replace(/\/$/, '');
const apiVersion = process.env.S9LAB_API_VERSION || 'v1';
const timeoutMs = Number(process.env.STATUS_TIMEOUT_MS || 12000);
const now = new Date();

const checks = [
  { id: 'backend', name: 'Backend API', url: `${baseUrl}/health`, validate: body => body?.ok === true },
  { id: 'catalog', name: 'Cosmetics API', url: `${baseUrl}/api/${apiVersion}/cosmetics`, validate: body => body?.ok === true && Array.isArray(body?.catalog) }
];

async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }
async function runCheck(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(check.url, { signal: controller.signal, headers: { 'User-Agent': 'S9Lab-Status-Monitor/1.0', 'Accept': 'application/json' } });
    const latencyMs = Math.round(performance.now() - started);
    let body = null; try { body = await response.json(); } catch {}
    const valid = response.ok && check.validate(body);
    return { id: check.id, name: check.name, status: valid ? (latencyMs > 2500 ? 'degraded' : 'operational') : 'outage', latencyMs, statusCode: response.status, checkedAt: now.toISOString(), message: valid ? (latencyMs > 2500 ? 'Erreichbar, aber langsam' : 'Dienst antwortet normal') : 'Unerwartete oder fehlerhafte Antwort' };
  } catch (error) {
    return { id: check.id, name: check.name, status: 'outage', latencyMs: Math.round(performance.now() - started), statusCode: null, checkedAt: now.toISOString(), message: error.name === 'AbortError' ? `Zeitüberschreitung nach ${timeoutMs} ms` : `Nicht erreichbar: ${error.message}` };
  } finally { clearTimeout(timer); }
}

const previous = await readJson(statusFile, { history: [], services: [] });
const incidentData = await readJson(incidentFile, { incidents: [] });
const services = await Promise.all(checks.map(runCheck));
const overall = services.some(s => s.status === 'outage') ? 'outage' : services.some(s => s.status === 'degraded') ? 'degraded' : 'operational';
const date = now.toISOString().slice(0,10);
const history = [...(previous.history || []).filter(x => x.date !== date), { date, status: overall }].slice(-90);

const wasDown = previous.overall === 'outage' || previous.overall === 'degraded';
const isDown = overall === 'outage' || overall === 'degraded';
const incidents = Array.isArray(incidentData.incidents) ? incidentData.incidents : [];
if (isDown && !wasDown) {
  incidents.push({ id: `incident-${now.getTime()}`, title: overall === 'outage' ? 'Automatisch erkannter Dienstausfall' : 'Automatisch erkannte Beeinträchtigung', message: services.filter(s => s.status !== 'operational').map(s => `${s.name}: ${s.message}`).join(' · '), startedAt: now.toISOString(), resolvedAt: null, affectedServices: services.filter(s => s.status !== 'operational').map(s => s.id) });
} else if (!isDown && wasDown) {
  const active = [...incidents].reverse().find(i => !i.resolvedAt);
  if (active) active.resolvedAt = now.toISOString();
}

await fs.writeFile(statusFile, JSON.stringify({ generatedAt: now.toISOString(), overall, services, history }, null, 2) + '\n');
await fs.writeFile(incidentFile, JSON.stringify({ incidents: incidents.slice(-100) }, null, 2) + '\n');
console.log(JSON.stringify({ overall, services }, null, 2));
