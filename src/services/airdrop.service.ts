/**
 * Airdrop tracker service.
 *
 * Airdrop data has no single authoritative free API, so this service reads from
 * the DB (curated/seeded entries, or entries ingested by an operator/webhook)
 * and exposes them to the /airdrop command. The shape matches the spec:
 * project, deadline, requirements, estimated reward, status, risk level, links.
 */
import { Airdrop } from '@prisma/client';
import { airdropRepository } from '../database/repositories/misc.repository';

export class AirdropService {
  /** List airdrops, optionally filtered by status. */
  async list(status?: string): Promise<Airdrop[]> {
    return airdropRepository.list(status);
  }

  /** Create a tracked airdrop (used by admin tooling / webhooks). */
  async add(input: {
    project: string;
    chain?: Airdrop['chain'];
    deadline?: Date;
    requirements?: string;
    estReward?: string;
    status?: string;
    riskLevel?: string;
    officialUrl?: string;
  }): Promise<Airdrop> {
    return airdropRepository.create({
      project: input.project,
      chain: input.chain ?? null,
      deadline: input.deadline ?? null,
      requirements: input.requirements ?? null,
      estReward: input.estReward ?? null,
      status: input.status ?? 'UPCOMING',
      riskLevel: input.riskLevel ?? 'UNKNOWN',
      officialUrl: input.officialUrl ?? null,
    });
  }
}

export const airdropService = new AirdropService();
