import { BadRequestException } from '@nestjs/common';

// the client must send a full date-time with an explicit offset (Z or +02:00), so the
// instant is unambiguous and stored as UTC
const HAS_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

export function parseInstant(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !HAS_OFFSET.test(value.trim()) || !value.includes('T')) {
    throw new BadRequestException(`${field} must be a full date-time with a time zone offset, e.g. 2026-01-01T09:00:00+02:00`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${field} is not a valid date-time`);
  return d;
}

export function checkWindow(opensAt: Date, closesAt: Date, now: Date = new Date()) {
  if (closesAt.getTime() <= opensAt.getTime()) throw new BadRequestException('closesAt must be after opensAt');
  if (closesAt.getTime() <= now.getTime()) throw new BadRequestException('closesAt must be in the future');
}

// whole minutes of the window, used as the stored timeLimit when the client sends none
export function windowMinutes(opensAt: Date, closesAt: Date): number {
  return Math.max(1, Math.ceil((closesAt.getTime() - opensAt.getTime()) / 60000));
}
