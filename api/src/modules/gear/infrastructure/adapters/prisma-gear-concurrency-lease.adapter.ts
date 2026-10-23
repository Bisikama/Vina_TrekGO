import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import {
  AcquireLeaseResult,
  GearConcurrencyLeasePort,
} from '../../application/ports/gear-concurrency-lease.port';

@Injectable()
export class PrismaGearConcurrencyLeaseAdapter implements GearConcurrencyLeasePort {
  constructor(private readonly prisma: PrismaService) {}

  async acquireLease(resourceKey: string, ownerToken: string, ttlMs: number): Promise<AcquireLeaseResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Try finding existing lease first
    const existing = await this.prisma.gearExtractionLease.findUnique({
      where: { resourceKey },
    });

    if (!existing) {
      // Try creating if does not exist
      try {
        const created = await this.prisma.gearExtractionLease.create({
          data: {
            resourceKey,
            ownerToken,
            fencingToken: 1,
            leaseExpiresAt: expiresAt,
          },
        });
        return { acquired: true, fencingToken: created.fencingToken };
      } catch (err: any) {
        if (err.code !== 'P2002') {
          throw err;
        }
      }
    }

    // Refresh state if just collided on create
    const current =
      existing ??
      (await this.prisma.gearExtractionLease.findUnique({
        where: { resourceKey },
      }));

    if (!current) {
      return { acquired: false, fencingToken: 0 };
    }

    // If same owner and still active: renew with conditional CAS
    if (current.ownerToken === ownerToken && current.leaseExpiresAt > now) {
      const updated = await this.prisma.gearExtractionLease.updateMany({
        where: {
          resourceKey,
          ownerToken,
          fencingToken: current.fencingToken,
          leaseExpiresAt: { gt: now },
        },
        data: {
          leaseExpiresAt: expiresAt,
        },
      });

      if (updated.count > 0) {
        return { acquired: true, fencingToken: current.fencingToken };
      }
      return { acquired: false, fencingToken: 0 };
    }

    // If active and held by different owner: cannot acquire
    if (current.leaseExpiresAt > now) {
      return { acquired: false, fencingToken: current.fencingToken };
    }

    // Expired lease: atomic takeover conditional on current fencingToken & expiry
    const result = await this.prisma.gearExtractionLease.updateMany({
      where: {
        resourceKey,
        fencingToken: current.fencingToken,
        leaseExpiresAt: { lte: now },
      },
      data: {
        ownerToken,
        fencingToken: { increment: 1 },
        leaseExpiresAt: expiresAt,
      },
    });

    if (result.count > 0) {
      return { acquired: true, fencingToken: current.fencingToken + 1 };
    }

    return { acquired: false, fencingToken: 0 };
  }

  async releaseLease(resourceKey: string, ownerToken: string, fencingToken: number): Promise<boolean> {
    const result = await this.prisma.gearExtractionLease.updateMany({
      where: {
        resourceKey,
        ownerToken,
        fencingToken,
        leaseExpiresAt: { gt: new Date() },
      },
      data: {
        ownerToken: '',
        leaseExpiresAt: new Date(0),
      },
    });
    return result.count > 0;
  }
}
