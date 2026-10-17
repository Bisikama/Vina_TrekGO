import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../shared/services/prisma.service'
import { AppError, TRIP_TRANSPORT_ERROR_CODES as E } from '../../../shared/errors'
import type { ProviderInput, ProviderUpdate, ProviderPage, TransportInput, TransportUpdate } from './transport.dto'

const fail = (code: string, message?: string): never => { throw AppError.fromCode(code, { message }) }

@Injectable()
export class TransportService {
  constructor(private readonly db: PrismaService) {}

  private async admin(db: Prisma.TransactionClient, actorId: string) {
    const actor = await db.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } })
    if (!actor || actor.role !== 'ADMIN' || actor.status !== 'ACTIVE') fail('FORBIDDEN')
  }
  private async audit(db: Prisma.TransactionClient, actorId: string, action: string, entityType: string, row: { id: string }) {
    await db.auditLog.create({ data: {
      userId: actorId, action, entityType, entityId: row.id,
      newValues: JSON.parse(JSON.stringify(row)) as Prisma.InputJsonObject,
    } })
  }
  async providers(actorId: string, page: ProviderPage) {
    await this.admin(this.db, actorId)
    const where = { status: page.status }
    const [items, total] = await this.db.$transaction([
      this.db.transportProvider.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (page.page - 1) * page.pageSize, take: page.pageSize }),
      this.db.transportProvider.count({ where }),
    ])
    return { items, total, page: page.page, pageSize: page.pageSize }
  }
  createProvider(actorId: string, data: ProviderInput) {
    return this.db.$transaction(async tx => {
      await this.admin(tx, actorId)
      const row = await tx.transportProvider.create({ data })
      await this.audit(tx, actorId, 'TRANSPORT_PROVIDER_CREATED', 'TransportProvider', row)
      return row
    })
  }
  updateProvider(actorId: string, id: string, data: ProviderUpdate) {
    return this.db.$transaction(async tx => {
      await this.admin(tx, actorId)
      await tx.$queryRaw`SELECT id FROM transport_providers WHERE id = ${id}::uuid FOR UPDATE`
      if (!await tx.transportProvider.findUnique({ where: { id } })) fail(E.NOT_FOUND)
      const row = await tx.transportProvider.update({ where: { id }, data })
      await this.audit(tx, actorId, 'TRANSPORT_PROVIDER_UPDATED', 'TransportProvider', row)
      return row
    })
  }
  private async trip(tx: Prisma.TransactionClient, tripId: string, write = false) {
    if (write) await tx.$queryRaw`SELECT id FROM trips WHERE id = ${tripId}::uuid FOR UPDATE`
    const trip = await tx.trip.findUnique({ where: { id: tripId } })
    if (!trip || trip.tripType !== 'PUBLIC') return fail(E.NOT_FOUND)
    if (write && (!['DRAFT', 'OPEN', 'FULL', 'CLOSED'].includes(trip.status) || trip.startAt <= new Date())) fail(E.LOCKED)
    return trip
  }
  async transports(actorId: string, tripId: string) {
    await this.admin(this.db, actorId)
    await this.trip(this.db, tripId)
    return this.db.tripTransport.findMany({ where: { tripId }, orderBy: { sequence: 'asc' } })
  }
  private async provider(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM transport_providers WHERE id = ${id}::uuid FOR SHARE`
    const provider = await tx.transportProvider.findUnique({ where: { id } })
    if (!provider || provider.status !== 'ACTIVE') return fail(E.PROVIDER_UNAVAILABLE)
    return provider
  }
  private validateTimes(startAt: Date, endAt: Date, meetingAt: Date, departureAt: Date | null, returnAt: Date | null) {
    if (meetingAt > startAt || (departureAt && (departureAt < meetingAt || departureAt > startAt)) ||
      (returnAt && returnAt < endAt)) fail('VALIDATION_ERROR', 'Giờ tập trung ≤ giờ xuất phát ≤ giờ bắt đầu trip; giờ về không trước giờ kết thúc trip.')
  }
  createTransport(actorId: string, tripId: string, input: TransportInput) {
    return this.db.$transaction(async tx => {
      await this.admin(tx, actorId)
      const trip = await this.trip(tx, tripId, true)
      if (!trip.pickupPointId) fail('VALIDATION_ERROR', 'Trip chưa có điểm tập kết.')
      const pickup = await tx.pickupPoint.findUnique({ where: { id: trip.pickupPointId! } })
      if (!pickup || pickup.status !== 'ACTIVE') fail('VALIDATION_ERROR', 'Điểm tập kết không sử dụng được.')
      const provider = await this.provider(tx, input.providerId)
      const meetingAt = new Date(input.meetingAt)
      const departureAt = input.departureAt ? new Date(input.departureAt) : null
      const returnAt = input.returnAt ? new Date(input.returnAt) : null
      this.validateTimes(trip.startAt, trip.endAt, meetingAt, departureAt, returnAt)
      const last = await tx.tripTransport.aggregate({ where: { tripId }, _max: { sequence: true } })
      const row = await tx.tripTransport.create({ data: {
        ...input, tripId, pickupPointId: trip.pickupPointId!, sourceType: 'THIRD_PARTY',
        providerName: provider.name, sequence: (last._max.sequence ?? 0) + 1,
        meetingAt, departureAt, returnAt,
      } })
      await this.audit(tx, actorId, 'TRIP_TRANSPORT_CREATED', 'TripTransport', row)
      return row
    })
  }
  updateTransport(actorId: string, tripId: string, id: string, input: TransportUpdate) {
    return this.db.$transaction(async tx => {
      await this.admin(tx, actorId)
      const trip = await this.trip(tx, tripId, true)
      const existing = await tx.tripTransport.findFirst({ where: { id, tripId } })
      if (!existing) return fail(E.NOT_FOUND)
      if (existing.version !== input.expectedVersion) fail(E.VERSION_CONFLICT)
      if (!['PLANNED', 'CONFIRMED'].includes(existing.status)) fail(E.LOCKED)
      const { expectedVersion, ...patch } = input
      const cancelling = patch.status === 'CANCELLED'
      const provider = patch.providerId && patch.providerId !== existing.providerId ? await this.provider(tx, patch.providerId) : null
      const meetingAt = patch.meetingAt ? new Date(patch.meetingAt) : existing.meetingAt
      const departureAt = patch.departureAt === undefined ? existing.departureAt : patch.departureAt ? new Date(patch.departureAt) : null
      const returnAt = patch.returnAt === undefined ? existing.returnAt : patch.returnAt ? new Date(patch.returnAt) : null
      if (!cancelling) {
        if (!trip.pickupPointId) fail('VALIDATION_ERROR', 'Trip chưa có điểm tập kết.')
        const pickup = await tx.pickupPoint.findUnique({ where: { id: trip.pickupPointId! } })
        if (!pickup || pickup.status !== 'ACTIVE') fail('VALIDATION_ERROR', 'Điểm tập kết không sử dụng được.')
        this.validateTimes(trip.startAt, trip.endAt, meetingAt, departureAt, returnAt)
      }
      const result = await tx.tripTransport.updateMany({ where: { id, tripId, version: expectedVersion }, data: {
        ...patch, meetingAt, departureAt, returnAt,
        pickupPointId: cancelling ? undefined : trip.pickupPointId!,
        providerName: provider?.name, version: { increment: 1 },
      } })
      if (!result.count) fail(E.VERSION_CONFLICT)
      const row = (await tx.tripTransport.findUniqueOrThrow({ where: { id } }))
      await this.audit(tx, actorId, 'TRIP_TRANSPORT_UPDATED', 'TripTransport', row)
      return row
    })
  }
}
