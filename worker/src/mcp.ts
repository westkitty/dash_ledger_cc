import { createMcpHandler, getMcpAuthContext } from 'agents/mcp/server';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import type { Env } from './env';
import {
  getPendingReviewSummary,
  getRecentShifts,
  getShift,
  getShiftsInRange,
  getSyncState,
  incrementUsage,
  queueProposal,
} from './db';
import {
  calculateCommuteHurdle,
  calculateOffer,
  summarizeShifts,
} from './calculations';
import {
  ExpenseProposalSchema,
  LocalDateSchema,
  ShiftUpdateProposalSchema,
} from './schemas';

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  };
}


function grantedScopes(context: { http?: { authInfo?: { scopes?: string[]; clientId?: string } } }): string[] {
  const fromHttp = context.http?.authInfo?.scopes;
  if (Array.isArray(fromHttp) && fromHttp.length) return fromHttp;
  const auth = getMcpAuthContext();
  const fromProps = auth?.props?.scopes;
  if (Array.isArray(fromProps) && fromProps.every((s) => typeof s === 'string')) {
    return fromProps as string[];
  }
  if (typeof fromProps === 'string') {
    return fromProps.split(/\s+/).filter(Boolean);
  }
  return [];
}

function requireProposeScope(context: { http?: { authInfo?: { scopes?: string[]; clientId?: string } } }) {
  if (!grantedScopes(context).includes('ledger.propose')) {
    throw new Error('insufficient_scope: ledger.propose is required.');
  }
}

function userIdFromContext(): string {
  const auth = getMcpAuthContext();
  const userId = auth?.props?.userId;
  if (typeof userId !== 'string' || !userId) {
    throw new Error('Authenticated Dash Ledger user is missing.');
  }
  return userId;
}

async function counted<T>(
  env: Env,
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await incrementUsage(env, userId, 'tool_calls');
  return fn();
}

export function buildMcpServer(env: Env) {
  const server = new McpServer({
    name: 'dash-ledger',
    version: '0.1.0',
  });

  server.registerTool(
    'get_sync_status',
    {
      description:
        'Return the freshness and version of the synchronized Dash Ledger mirror.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async () => {
      const userId = userIdFromContext();
      return counted(env, userId, async () => {
        const state = await getSyncState(env, userId);
        if (!state) {
          return jsonResult({
            synchronized: false,
            freshnessStatus: 'unknown',
          });
        }
        const ageSeconds = Math.max(
          0,
          Math.floor(
            (Date.now() - new Date(state.source_generated_at).getTime()) /
              1000,
          ),
        );
        const freshnessStatus =
          ageSeconds <= 300
            ? 'fresh'
            : ageSeconds <= 1800
              ? 'aging'
              : 'stale';
        return jsonResult({
          synchronized: true,
          sourceGeneratedAt: state.source_generated_at,
          serverReceivedAt: state.server_received_at,
          ageSeconds,
          freshnessStatus,
          snapshotVersion: state.latest_snapshot_version,
          counts: {
            vehicles: state.vehicle_count,
            shifts: state.shift_count,
            expenses: state.expense_count,
            mileageRates: state.mileage_rate_count,
          },
        });
      });
    },
  );

  server.registerTool(
    'get_ledger_summary',
    {
      description:
        'Summarize synchronized shifts for a bounded local-date range. Time is tracked shift time, not inferred door-to-door time.',
      inputSchema: {
        startDate: LocalDateSchema,
        endDate: LocalDateSchema,
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ startDate, endDate }) => {
      const userId = userIdFromContext();
      if (startDate > endDate) {
        throw new Error('startDate must be on or before endDate.');
      }
      return counted(env, userId, async () =>
        jsonResult({
          startDate,
          endDate,
          ...summarizeShifts(
            await getShiftsInRange(env, userId, startDate, endDate),
          ),
        }),
      );
    },
  );

  server.registerTool(
    'get_recent_shifts',
    {
      description:
        'Return recent synchronized shift records, bounded to at most 100 rows.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ limit }) => {
      const userId = userIdFromContext();
      return counted(env, userId, async () =>
        jsonResult(await getRecentShifts(env, userId, limit)),
      );
    },
  );

  server.registerTool(
    'get_shift',
    {
      description: 'Return one synchronized shift by ID.',
      inputSchema: { shiftId: z.string().min(1).max(128) },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ shiftId }) => {
      const userId = userIdFromContext();
      return counted(env, userId, async () =>
        jsonResult(await getShift(env, userId, shiftId)),
      );
    },
  );

  server.registerTool(
    'compare_periods',
    {
      description:
        'Compare deterministic Dash Ledger shift totals between two local-date ranges.',
      inputSchema: {
        aStartDate: LocalDateSchema,
        aEndDate: LocalDateSchema,
        bStartDate: LocalDateSchema,
        bEndDate: LocalDateSchema,
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ aStartDate, aEndDate, bStartDate, bEndDate }) => {
      const userId = userIdFromContext();
      if (aStartDate > aEndDate || bStartDate > bEndDate) {
        throw new Error('Each period must have start <= end.');
      }
      return counted(env, userId, async () => {
        const [a, b] = await Promise.all([
          getShiftsInRange(env, userId, aStartDate, aEndDate),
          getShiftsInRange(env, userId, bStartDate, bEndDate),
        ]);
        return jsonResult({
          periodA: {
            startDate: aStartDate,
            endDate: aEndDate,
            ...summarizeShifts(a),
          },
          periodB: {
            startDate: bStartDate,
            endDate: bEndDate,
            ...summarizeShifts(b),
          },
        });
      });
    },
  );

  server.registerTool(
    'get_pending_review_summary',
    {
      description:
        'Count synchronized records that need human review. Receipt-image issues are local-only and intentionally excluded.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async () => {
      const userId = userIdFromContext();
      return counted(env, userId, async () =>
        jsonResult(await getPendingReviewSummary(env, userId)),
      );
    },
  );

  server.registerTool(
    'calculate_commute_hurdle',
    {
      description:
        'Calculate the extra gross needed to justify deliberate outbound and return travel from explicit mileage and time assumptions.',
      inputSchema: {
        outboundMiles: z.number().nonnegative(),
        returnMiles: z.number().nonnegative(),
        outboundMinutes: z.number().nonnegative(),
        returnMinutes: z.number().nonnegative(),
        vehicleCostPerMile: z.number().nonnegative(),
        valueOfTimePerHour: z.number().nonnegative(),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async (input) => jsonResult(calculateCommuteHurdle(input)),
  );

  server.registerTool(
    'calculate_offer_threshold',
    {
      description:
        'Calculate modeled operating contribution, per-hour, and per-mile metrics for a proposed delivery using explicit recovery miles.',
      inputSchema: {
        grossCents: z.number().int().nonnegative(),
        activeMinutes: z.number().nonnegative(),
        deliveryMiles: z.number().nonnegative(),
        recoveryMiles: z.number().nonnegative(),
        vehicleCostPerMile: z.number().nonnegative(),
        tollsCents: z.number().int().nonnegative().optional(),
        parkingCents: z.number().int().nonnegative().optional(),
        otherDirectCostsCents: z
          .number()
          .int()
          .nonnegative()
          .optional(),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async (input) => jsonResult(calculateOffer(input)),
  );

  server.registerTool(
    'queue_expense_proposal',
    {
      description:
        'Queue an expense proposal for review inside Dash Ledger. This does not directly modify the canonical local ledger.',
      inputSchema: ExpenseProposalSchema.shape,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async (input, context) => {
      const userId = userIdFromContext();
      requireProposeScope(context);
      const parsed = ExpenseProposalSchema.parse(input);
      return counted(env, userId, async () => {
        await incrementUsage(env, userId, 'proposals');
        const row = await queueProposal(env, {
          userId,
          kind: 'expense',
          payload: parsed,
          idempotencyKey: parsed.clientRequestId,
          sourceClient: context.http?.authInfo?.clientId ?? null,
        });
        return jsonResult({
          proposalId: row.id,
          status: row.status,
          queued: true,
        });
      });
    },
  );

  server.registerTool(
    'queue_shift_update_proposal',
    {
      description:
        'Queue a bounded shift-update proposal for review inside Dash Ledger. This does not directly modify the canonical local ledger.',
      inputSchema: ShiftUpdateProposalSchema.shape,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async (input, context) => {
      const userId = userIdFromContext();
      requireProposeScope(context);
      const parsed = ShiftUpdateProposalSchema.parse(input);
      const shift = await getShift(env, userId, parsed.shiftId);
      if (!shift) {
        throw new Error('Shift not found in the synchronized mirror.');
      }
      return counted(env, userId, async () => {
        await incrementUsage(env, userId, 'proposals');
        const row = await queueProposal(env, {
          userId,
          kind: 'shift_update',
          payload: parsed,
          idempotencyKey: parsed.clientRequestId,
          sourceClient: context.http?.authInfo?.clientId ?? null,
        });
        return jsonResult({
          proposalId: row.id,
          status: row.status,
          queued: true,
        });
      });
    },
  );

  return server;
}

export const mcpApiHandler = {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return createMcpHandler(() => buildMcpServer(env))(request, env, ctx);
  },
};
