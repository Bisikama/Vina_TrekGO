import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../../shared/services/prisma.service'
import {
  CreateWeatherSnapshotInput,
  TripWeatherContext,
  WeatherPort,
  WeatherSnapshotRecord,
} from '../../application/ports/weather.port'

@Injectable()
export class PrismaWeatherAdapter implements WeatherPort {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestByTripId(tripId: string): Promise<WeatherSnapshotRecord | null> {
    const row = await this.prisma.weatherSnapshot.findFirst({
      where: { tripId },
      orderBy: { observedAt: 'desc' },
    })

    if (!row) return null
    return this.mapToRecord(row)
  }

  async createSnapshot(data: CreateWeatherSnapshotInput): Promise<WeatherSnapshotRecord> {
    const row = await this.prisma.weatherSnapshot.create({
      data: {
        tripId: data.tripId,
        tripCheckpointId: data.tripCheckpointId ?? null,
        latitude: new Prisma.Decimal(data.latitude),
        longitude: new Prisma.Decimal(data.longitude),
        provider: data.provider,
        temperatureC: data.temperatureC != null ? new Prisma.Decimal(data.temperatureC) : null,
        apparentTemperatureC: data.apparentTemperatureC != null ? new Prisma.Decimal(data.apparentTemperatureC) : null,
        humidityPercent: data.humidityPercent != null ? new Prisma.Decimal(data.humidityPercent) : null,
        windSpeedMps: data.windSpeedMps != null ? new Prisma.Decimal(data.windSpeedMps) : null,
        windGustMps: data.windGustMps != null ? new Prisma.Decimal(data.windGustMps) : null,
        precipitationMm: data.precipitationMm != null ? new Prisma.Decimal(data.precipitationMm) : null,
        rainProbabilityPercent: data.rainProbabilityPercent != null ? new Prisma.Decimal(data.rainProbabilityPercent) : null,
        weatherCode: data.weatherCode ?? null,
        weatherCondition: data.weatherCondition ?? null,
        riskLevel: data.riskLevel,
        riskSummary: data.riskSummary ?? null,
        forecastData: data.forecastData ?? Prisma.DbNull,
        observedAt: data.observedAt,
        expiresAt: data.expiresAt ?? null,
      },
    })

    return this.mapToRecord(row)
  }

  async findTripContext(tripId: string): Promise<TripWeatherContext | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        destination: true,
        tripMembersViaTripId: {
          where: { status: 'ACTIVE' },
          select: { userId: true },
        },
        bookingsViaTripId: {
          where: {
            status: { in: ['CONFIRMED', 'PARTIAL_CHECKIN', 'CHECKED_IN', 'COMPLETED'] },
          },
          select: { userId: true },
        },
      },
    })

    if (!trip) return null

    // Lấy tọa độ từ destination (mặc định Sa Pa / Fansipan nếu destination chưa có tọa độ)
    const lat = trip.destination?.centerLat ? Number(trip.destination.centerLat) : 22.3038
    const lng = trip.destination?.centerLng ? Number(trip.destination.centerLng) : 103.7752

    return {
      id: trip.id,
      title: trip.title,
      startAt: trip.startAt,
      endAt: trip.endAt,
      destinationId: trip.destinationId,
      destinationName: trip.destination?.name ?? 'Địa điểm leo núi',
      latitude: lat,
      longitude: lng,
      creatorId: trip.creatorId,
      leaderId: trip.leaderId,
      memberUserIds: trip.tripMembersViaTripId.map((m) => m.userId),
      bookingUserIds: trip.bookingsViaTripId.map((b) => b.userId),
    }
  }

  private mapToRecord(row: any): WeatherSnapshotRecord {
    return {
      id: row.id,
      tripId: row.tripId,
      tripCheckpointId: row.tripCheckpointId,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      provider: row.provider,
      temperatureC: row.temperatureC != null ? Number(row.temperatureC) : null,
      apparentTemperatureC: row.apparentTemperatureC != null ? Number(row.apparentTemperatureC) : null,
      humidityPercent: row.humidityPercent != null ? Number(row.humidityPercent) : null,
      windSpeedMps: row.windSpeedMps != null ? Number(row.windSpeedMps) : null,
      windGustMps: row.windGustMps != null ? Number(row.windGustMps) : null,
      precipitationMm: row.precipitationMm != null ? Number(row.precipitationMm) : null,
      rainProbabilityPercent: row.rainProbabilityPercent != null ? Number(row.rainProbabilityPercent) : null,
      weatherCode: row.weatherCode,
      weatherCondition: row.weatherCondition,
      riskLevel: row.riskLevel,
      riskSummary: row.riskSummary,
      forecastData: row.forecastData,
      observedAt: row.observedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    }
  }
}
