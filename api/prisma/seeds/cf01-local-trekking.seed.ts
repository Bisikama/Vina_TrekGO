import { config } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { routeIssues } from '../../src/modules/trips/application/trip.policy';

config({ quiet: true });

const DEMO = 'DỮ LIỆU DEMO CF01: tọa độ, đường đi, độ khó và thông số mô phỏng để kiểm thử; không dùng dẫn đường hoặc tổ chức trekking thực tế.';
// A separate namespace keeps these fixtures independent of existing destinations.
const uuid = (site: number, item: number) =>
  `cf010000-0000-4000-8000-${String(site * 1000 + item).padStart(12, '0')}`;

function catalog(actorId: string) {
  return [
    { key: 'BADEN', name: 'Núi Bà Đen - Tây Ninh', lat: 11.374, lng: 106.153 },
    { key: 'CHUACHAN', name: 'Núi Chứa Chan - Đồng Nai', lat: 10.93, lng: 107.393 },
  ].map((site, index) => {
    const id = (item: number) => uuid(index + 1, item);
    const destination = {
      id: id(1), name: `[DEMO CF01] ${site.name}`, description: DEMO,
      region: 'SOUTH', centerLat: site.lat, centerLng: site.lng, status: 'ACTIVE' as const,
    };
    const checkpoints = ['Xuất phát', 'Trung gian 1', 'Trung gian 2', 'Đích'].map((label, i) => ({
      id: id(10 + i), destinationId: destination.id, code: `CF01_LOCAL_${site.key}_CP${i + 1}`,
      name: `[DEMO CF01] ${site.name} - ${label}`, description: DEMO,
      latitude: Number((site.lat + i * 0.002).toFixed(7)),
      longitude: Number((site.lng + i * 0.002).toFixed(7)),
      defaultRadiusMeters: 50, status: 'ACTIVE' as const,
    }));
    const pickup = {
      id: id(2), destinationId: destination.id, code: `CF01_LOCAL_${site.key}_PICKUP`,
      name: `[DEMO CF01] ${site.name} - Tập kết`, address: `Điểm mô phỏng tại khu vực ${site.name}`,
      latitude: site.lat, longitude: site.lng, note: DEMO, status: 'ACTIVE' as const, createdBy: actorId,
    };
    const trails = [[0, 1, 2], [2, 3]].map((indices, i) => ({
      id: id(20 + i), destinationId: destination.id, code: `CF01_LOCAL_${site.key}_TRAIL${i + 1}`,
      name: `[DEMO CF01] ${site.name} - Chặng ${i + 1}`, description: DEMO,
      difficulty: 'MEDIUM' as const, distanceKm: i === 0 ? 0.62 : 0.31,
      elevationGainM: 0, estimatedDurationMinutes: i === 0 ? 30 : 15,
      routeGeojson: { type: 'LineString', coordinates: indices.map((n) => [checkpoints[n].longitude, checkpoints[n].latitude]) },
      price: 0, status: 'ACTIVE' as const, createdBy: actorId, version: 1,
    }));
    const links = [[0, 1, 2], [2, 3]].flatMap((indices, i) => indices.map((n, j) => ({
      id: id(30 + i * 10 + j), systemTrailId: trails[i].id, checkpointId: checkpoints[n].id,
      sequence: j + 1, isRequired: true,
    })));
    return { destination, pickup, checkpoints, trails, links };
  });
}

function validateCatalog(sites: ReturnType<typeof catalog>) {
  for (const site of sites) {
    const trails = site.trails.map((t) => ({
      id: t.id, checkpointIds: site.links.filter((l) => l.systemTrailId === t.id).map((l) => l.checkpointId),
    }));
    const issues = routeIssues(site.checkpoints.map((c) => c.id), trails);
    if (issues.length) throw new Error(`Invalid demo route: ${issues[0].message}`);
    if (!routeIssues(site.checkpoints.map((c) => c.id), [...trails].reverse()).length)
      throw new Error('Reversed demo trails must fail route validation.');
  }
}

// Compare only seed-owned fields; never overwrite edited fixtures or unrelated rows.
function equivalent(actual: unknown, expected: unknown): boolean {
  if (actual instanceof Prisma.Decimal) return actual.equals(String(expected));
  if (Array.isArray(expected))
    return Array.isArray(actual) && actual.length === expected.length && expected.every((v, i) => equivalent(actual[i], v));
  if (expected !== null && typeof expected === 'object')
    return actual !== null && typeof actual === 'object' && Object.entries(expected).every(([k, v]) => equivalent(actual[k], v));
  return actual === expected;
}

async function main() {
  const args = process.argv.slice(2);
  const usage = 'npm run seed:cf01-local -- [--dry-run | --validate-only] [--actor-user-id=UUID]';
  if (args.includes('--help')) { console.log(usage); return; }
  if (args.some((a) => !['--dry-run', '--validate-only'].includes(a) && !a.startsWith('--actor-user-id=')) ||
      args.filter((a) => a.startsWith('--actor-user-id=')).length > 1 ||
      (args.includes('--dry-run') && args.includes('--validate-only'))) throw new Error(usage);
  const actorId = args.find((a) => a.startsWith('--actor-user-id='))?.split('=')[1];
  if (actorId !== undefined && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(actorId))
    throw new Error('actor-user-id must be users.id (UUID), not Supabase authUserId.');
  validateCatalog(catalog(uuid(0, 1)));
  if (args.includes('--validate-only')) {
    console.log('Catalog valid: 2 destinations, 2 pickups, 8 checkpoints, 4 trails, 10 trail-checkpoint links. No database access.');
    return;
  }
  const dryRun = args.includes('--dry-run');
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (!dryRun) await tx.$queryRaw`SELECT pg_advisory_xact_lock(1042026, 2)::text`;
      const actors = await tx.user.findMany({
        where: { role: 'LEADER', status: 'ACTIVE', ...(actorId ? { id: actorId } : {}) },
        select: { id: true }, take: 2,
      });
      if (actors.length !== 1) throw new Error('Select one existing ACTIVE LEADER with --actor-user-id=UUID. No users were changed.');
      const actions: Array<{ entity: string; id: string; action: string }> = [];
      async function ensure(
        entity: string, data: { id: string }, existing: unknown, create: () => Promise<unknown>,
      ) {
        if (existing && !equivalent(existing, data)) throw new Error(`Conflicting ${entity} ${data.id}; no existing data will be overwritten.`);
        if (!existing && !dryRun) await create();
        actions.push({ entity, id: data.id, action: existing ? 'UNCHANGED' : dryRun ? 'WOULD_CREATE' : 'CREATED' });
      }
      const sites = catalog(actors[0].id);
      for (const site of sites) {
        const d = site.destination;
        await ensure('destination', d, await tx.destination.findUnique({ where: { id: d.id } }), () => tx.destination.create({ data: d }));
        const p = site.pickup;
        await ensure('pickup', p, await tx.pickupPoint.findFirst({ where: { OR: [{ id: p.id }, { code: p.code }] } }), () => tx.pickupPoint.create({ data: p }));
        for (const c of site.checkpoints)
          await ensure('checkpoint', c, await tx.checkpoint.findFirst({ where: { OR: [{ id: c.id }, { code: c.code }] } }), () => tx.checkpoint.create({ data: c }));
        for (const t of site.trails) {
          await ensure('trail', t, await tx.systemTrail.findFirst({ where: { OR: [{ id: t.id }, { code: t.code }] } }), () => tx.systemTrail.create({ data: t }));
          const existingLinks = await tx.trailCheckpoint.findMany({ where: { systemTrailId: t.id } });
          if (existingLinks.some((l) => !site.links.some((expected) => expected.id === l.id)))
            throw new Error(`Unexpected checkpoint links on demo trail ${t.id}; no links will be removed.`);
        }
        for (const l of site.links)
          await ensure('trailCheckpoint', l, await tx.trailCheckpoint.findUnique({ where: { id: l.id } }), () => tx.trailCheckpoint.create({ data: l }));
      }
      return {
        mode: dryRun ? 'DRY_RUN (no writes)' : 'APPLIED', actions,
        selections: sites.map((s) => ({
          destination: s.destination.name, destinationId: s.destination.id, pickupPointId: s.pickup.id,
          checkpointIds: s.checkpoints.map((c) => c.id), systemTrailIds: s.trails.map((t) => t.id),
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
    console.log(JSON.stringify(result, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    console.error(`CF01 local seed aborted (${error.code}); transaction rolled back.`);
  else if (error instanceof Prisma.PrismaClientInitializationError)
    console.error('Cannot connect to database. Check API database configuration.');
  else console.error(error instanceof Error ? error.message : 'CF01 local seed failed.');
  process.exitCode = 1;
});
