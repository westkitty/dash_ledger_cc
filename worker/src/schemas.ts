import { z } from 'zod';

export const UserIdSchema = z.string().regex(/^[a-z0-9_-]{1,64}$/);
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const LocalTimeSchema = z.string().regex(/^\d{2}:\d{2}$/);
export const TaxClassSchema = z.enum([
  'VEHICLE_ACTUAL',
  'MILEAGE_ADDON',
  'NON_VEHICLE_BUSINESS',
  'REVIEW',
]);

const nullableFiniteNumber = z.number().finite().nullable();

export const VehicleSchema = z.object({
  id: z.string().min(1).max(128),
  label: z.string().max(200),
  archived: z.boolean(),
  createdAt: z.string().min(1).max(80),
  updatedAt: z.string().min(1).max(80),
}).strict();

export const ShiftSchema = z.object({
  id: z.string().min(1).max(128),
  status: z.enum(['active', 'completed']),
  date: LocalDateSchema,
  weekKey: LocalDateSchema,
  vehicleId: z.string().min(1).max(128),
  vehicleLabel: z.string().max(200),
  startTime: LocalTimeSchema.nullable(),
  endTime: LocalTimeSchema.nullable(),
  startOdometer: nullableFiniteNumber,
  endOdometer: nullableFiniteNumber,
  appEarningsCents: z.number().int().nullable(),
  cashTipsCents: z.number().int().nullable(),
  purpose: z.string().max(400),
  createdAt: z.string().min(1).max(80),
  updatedAt: z.string().min(1).max(80),
}).strict();

export const ExpenseSchema = z.object({
  id: z.string().min(1).max(128),
  date: LocalDateSchema,
  amountCents: z.number().int().nonnegative(),
  category: z.string().max(200),
  taxClass: TaxClassSchema,
  shiftId: z.string().max(128).nullable(),
  createdAt: z.string().min(1).max(80),
  updatedAt: z.string().min(1).max(80),
}).strict();

export const MileageRateSchema = z.object({
  id: z.string().min(1).max(128),
  startDate: LocalDateSchema,
  endDate: LocalDateSchema.nullable(),
  ratePerMile: z.number().finite().nonnegative(),
  label: z.string().max(200),
  source: z.string().max(500),
  seeded: z.boolean(),
}).strict();

export const GptSyncSnapshotSchema = z.object({
  format: z.literal('dash-ledger-gpt-sync-v1'),
  formatVersion: z.literal(1),
  schemaVersion: z.number().int().positive(),
  generatedAt: z.string().min(1).max(80),
  deviceId: z.string().min(1).max(128),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  settings: z.object({
    implausibleMiles: z.number().finite().positive().max(5_000),
  }).strict(),
  vehicles: z.array(VehicleSchema).max(5_000),
  shifts: z.array(ShiftSchema).max(20_000),
  expenses: z.array(ExpenseSchema).max(50_000),
  mileageRates: z.array(MileageRateSchema).max(5_000),
}).strict();

export type GptSyncSnapshot = z.infer<typeof GptSyncSnapshotSchema>;

export const PairRequestSchema = z.object({
  userId: UserIdSchema,
  loginSecret: z.string().min(24).max(512),
  deviceLabel: z.string().min(1).max(120),
}).strict();

export const BootstrapUserSchema = z.object({
  userId: UserIdSchema,
  displayLabel: z.string().min(1).max(120),
  loginSecret: z.string().min(24).max(512),
}).strict();

export const ExpenseProposalSchema = z.object({
  clientRequestId: z.string().min(8).max(200),
  date: LocalDateSchema,
  amountCents: z.number().int().positive(),
  merchant: z.string().max(200).default(''),
  category: z.string().min(1).max(200),
  taxClass: TaxClassSchema,
  notes: z.string().max(1000).default(''),
  shiftId: z.string().max(128).nullable().default(null),
}).strict();

export const ShiftUpdateProposalSchema = z.object({
  clientRequestId: z.string().min(8).max(200),
  shiftId: z.string().min(1).max(128),
  patch: z.object({
    date: LocalDateSchema.optional(),
    startTime: LocalTimeSchema.nullable().optional(),
    endTime: LocalTimeSchema.nullable().optional(),
    startOdometer: nullableFiniteNumber.optional(),
    endOdometer: nullableFiniteNumber.optional(),
    appEarningsCents: z.number().int().nullable().optional(),
    cashTipsCents: z.number().int().nullable().optional(),
    purpose: z.string().max(400).optional(),
    status: z.enum(['active', 'completed']).optional(),
  }).strict().refine((v) => Object.keys(v).length > 0, 'patch must contain at least one field'),
}).strict();
