/**
 * Webhook receiver for supported providers.
 *  POST /webhooks/provider — signature-verified inbound events (e.g. alert
 *  triggers, airdrop updates, whale feeds from an external service).
 *
 * The signature check (verifyWebhook) runs before this handler. Payloads are
 * validated with Zod before being acted upon.
 */
import { Router } from 'express';
import { z } from 'zod';
import { verifyWebhook } from '../../middlewares/api.middleware';
import { airdropService } from '../../services/airdrop.service';
import { createLogger } from '../../utils/logger';

const log = createLogger('Webhook');

export const webhookRouter = Router();

/** Discriminated union of accepted webhook events. */
const webhookSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('airdrop.upsert'),
    project: z.string().min(1),
    deadline: z.string().datetime().optional(),
    requirements: z.string().optional(),
    estReward: z.string().optional(),
    status: z.string().optional(),
    riskLevel: z.string().optional(),
    officialUrl: z.string().url().optional(),
  }),
  z.object({ type: z.literal('ping') }),
]);

webhookRouter.post('/provider', verifyWebhook, async (req, res, next) => {
  try {
    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
      return;
    }
    const event = parsed.data;

    switch (event.type) {
      case 'ping':
        res.json({ ok: true, pong: true });
        return;
      case 'airdrop.upsert':
        await airdropService.add({
          project: event.project,
          deadline: event.deadline ? new Date(event.deadline) : undefined,
          requirements: event.requirements,
          estReward: event.estReward,
          status: event.status,
          riskLevel: event.riskLevel,
          officialUrl: event.officialUrl,
        });
        log.info('Airdrop upserted via webhook', { project: event.project });
        res.json({ ok: true });
        return;
    }
  } catch (error) {
    next(error);
  }
});
