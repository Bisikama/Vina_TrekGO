import { config } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';

config({ quiet: true });

// Demo pickup choices only. Never invoke the navigation/rental seed or change users.
const destinations = {
  baden: 'd1000000-0000-0000-0000-000000000001',
  fansipan: 'b257bbf6-b37c-4453-a225-d19b9235378c',
  hoanglien: '33333333-3333-3333-3333-333333333333',
};
const points = [
  { code: 'CF01_DEMO_BADEN_01', destinationId: destinations.baden, name: '[DEMO CF01] Núi Bà Đen - Điểm tập kết 1' },
  { code: 'CF01_DEMO_BADEN_02', destinationId: destinations.baden, name: '[DEMO CF01] Núi Bà Đen - Điểm tập kết 2' },
  { code: 'CF01_DEMO_FANSIPAN_01', destinationId: destinations.fansipan, name: '[DEMO CF01] Fansipan - Điểm tập kết 1' },
] as const;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const actorArg = args.find((arg) => arg.startsWith('--actor-user-id='));
  if (args.some((arg) => arg !== '--dry-run' && arg !== actorArg))
    throw new Error('Usage: npm run seed:cf01 -- [--dry-run] [--actor-user-id=UUID]');
  const actorId = actorArg?.slice('--actor-user-id='.length);
  if (actorArg && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(actorId!))
    throw new Error('actor-user-id must be a User UUID, not an email or Supabase token.');

  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serializes simultaneous runs of this seed. All validation and writes are atomic.
      if (!dryRun) await tx.$queryRaw`SELECT pg_advisory_xact_lock(1042026, 1)::text`;
      const actors = await tx.user.findMany({
        where: { status: 'ACTIVE', role: 'LEADER', ...(actorId ? { id: actorId } : {}) },
        select: { id: true },
        take: 2,
      });
      if (actors.length !== 1)
        throw new Error('Expected one ACTIVE LEADER; select an existing account with --actor-user-id=UUID. No account was changed.');

      const catalog = await tx.destination.findMany({
        where: { id: { in: [destinations.baden, destinations.fansipan] } },
        select: { id: true, name: true, status: true, centerLat: true, centerLng: true },
      });
      for (const id of [destinations.baden, destinations.fansipan]) {
        if (catalog.find((d) => d.id === id)?.status !== 'ACTIVE')
          throw new Error(`Missing/inactive destination ${id}; no destination will be created or replaced.`);
      }

      const actions: Array<{ code: string; destination: string; action: string; id?: string }> = [];
      for (const point of points) {
        const destination = catalog.find((d) => d.id === point.destinationId)!;
        const existing = await tx.pickupPoint.findUnique({
          where: { code: point.code },
          select: { id: true, destinationId: true, status: true },
        });
        if (existing) {
          if (existing.destinationId !== point.destinationId || existing.status !== 'ACTIVE')
            throw new Error(`Conflicting existing pickup ${point.code}; seed will not overwrite its destination or status.`);
          actions.push({ code: point.code, destination: destination.name, action: 'UNCHANGED', id: existing.id });
          continue;
        }
        const latitude = destination.centerLat, longitude = destination.centerLng;
        if (latitude === null || longitude === null || latitude.abs().gt(90) || longitude.abs().gt(180))
          throw new Error(`Destination ${destination.name} requires valid center coordinates for the demo marker.`);
        // Coordinates deliberately use the destination center, not an invented real pickup address.
        const data = {
          ...point,
          address: `DỮ LIỆU DEMO - khu vực ${destination.name}; chưa xác minh điểm đón thực tế.`,
          latitude, longitude,
          note: 'CF01 demo only. Tọa độ lấy từ tâm Destination để kiểm thử lựa chọn; không dùng tổ chức đón khách thực tế.',
          status: 'ACTIVE' as const,
          createdBy: actors[0].id,
        };
        const created = dryRun ? null : await tx.pickupPoint.create({ data, select: { id: true } });
        actions.push({ code: point.code, destination: destination.name, action: dryRun ? 'WOULD_CREATE' : 'CREATED', ...(created ? { id: created.id } : {}) });
      }
      const coverage = [] as Array<{ destination: string; selectablePickups: number }>;
      for (const id of Object.values(destinations)) {
        const destination = await tx.destination.findUnique({ where: { id }, select: { name: true } });
        if (!destination) continue;
        const selectablePickups = await tx.pickupPoint.count({
          where: { status: 'ACTIVE', OR: [{ destinationId: id }, { destinationId: null }] },
        });
        coverage.push({ destination: destination.name, selectablePickups });
      }
      return { mode: dryRun ? 'DRY_RUN (no writes; coverage is current DB)' : 'APPLIED', actions, coverage };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Do not print connection strings or database query payloads.
  if (error instanceof Prisma.PrismaClientKnownRequestError)
    console.error(`CF01 seed aborted (${error.code}). Transaction rolled back; retry after resolving the conflict.`);
  else if (error instanceof Prisma.PrismaClientInitializationError)
    console.error('CF01 seed could not connect. Check database access/configuration.');
  else console.error(error instanceof Error ? error.message : 'CF01 seed failed.');
  process.exitCode = 1;
});
