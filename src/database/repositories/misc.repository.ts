/**
 * Miscellaneous repositories: news, airdrops, guilds and job runs.
 * Grouped together because each is small and closely tied to a single service.
 */
import {
  Airdrop,
  Guild,
  GuildSetting,
  JobRun,
  JobStatus,
  NewsArticle,
  NewsCategory,
  NewsSubscription,
  Prisma,
} from '@prisma/client';
import { prisma } from '../prisma';

/** News subscriptions & cached articles. */
export class NewsRepository {
  listSubscriptions(userId: string): Promise<NewsSubscription[]> {
    return prisma.newsSubscription.findMany({ where: { userId } });
  }

  subscribe(userId: string, category: NewsCategory): Promise<NewsSubscription> {
    return prisma.newsSubscription.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category },
      update: {},
    });
  }

  unsubscribe(userId: string, category: NewsCategory): Promise<Prisma.BatchPayload> {
    return prisma.newsSubscription.deleteMany({ where: { userId, category } });
  }

  subscribersFor(category: NewsCategory): Promise<NewsSubscription[]> {
    return prisma.newsSubscription.findMany({ where: { category } });
  }

  upsertArticle(data: Prisma.NewsArticleCreateInput): Promise<NewsArticle> {
    return prisma.newsArticle.upsert({
      where: { url: data.url },
      create: data,
      update: { summary: data.summary, category: data.category },
    });
  }

  latestArticles(category?: NewsCategory, take = 10): Promise<NewsArticle[]> {
    return prisma.newsArticle.findMany({
      where: category ? { category } : {},
      orderBy: { publishedAt: 'desc' },
      take,
    });
  }
}

/** Airdrop tracking. */
export class AirdropRepository {
  list(status?: string, take = 25): Promise<Airdrop[]> {
    return prisma.airdrop.findMany({
      where: status ? { status } : {},
      orderBy: { deadline: { sort: 'asc', nulls: 'last' } },
      take,
    });
  }

  upsert(project: string, data: Prisma.AirdropCreateInput): Promise<Airdrop> {
    return prisma.airdrop.upsert({
      // project isn't unique in schema; emulate upsert via find-then-write.
      where: { id: data.id ?? '__none__' },
      create: { ...data, project },
      update: data,
    });
  }

  create(data: Prisma.AirdropCreateInput): Promise<Airdrop> {
    return prisma.airdrop.create({ data });
  }
}

/** Guild rows & per-guild settings. */
export class GuildRepository {
  count(): Promise<number> {
    return prisma.guild.count();
  }

  getSettings(guildId: string): Promise<GuildSetting | null> {
    return prisma.guildSetting.findUnique({ where: { guildId } });
  }

  upsert(id: string, name?: string): Promise<Guild> {
    return prisma.guild.upsert({
      where: { id },
      create: { id, name },
      update: { name },
    });
  }

  updateSettings(
    guildId: string,
    data: Prisma.GuildSettingUncheckedUpdateInput,
  ): Promise<GuildSetting> {
    const { guildId: _ignored, ...rest } = data as Prisma.GuildSettingUncheckedCreateInput;
    return prisma.guildSetting.upsert({
      where: { guildId },
      create: { guildId, ...rest },
      update: data,
    });
  }
}

/** Background job run history (scheduler & /admin jobs). */
export class JobRepository {
  start(name: string): Promise<JobRun> {
    return prisma.jobRun.create({
      data: { name, status: JobStatus.RUNNING, startedAt: new Date(), attempts: 1 },
    });
  }

  finish(id: string, status: JobStatus, durationMs: number, error?: string): Promise<JobRun> {
    return prisma.jobRun.update({
      where: { id },
      data: { status, finishedAt: new Date(), durationMs, lastError: error },
    });
  }

  incrementAttempt(id: string): Promise<JobRun> {
    return prisma.jobRun.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  recent(take = 20): Promise<JobRun[]> {
    return prisma.jobRun.findMany({ orderBy: { createdAt: 'desc' }, take });
  }

  recentByName(name: string, take = 5): Promise<JobRun[]> {
    return prisma.jobRun.findMany({ where: { name }, orderBy: { createdAt: 'desc' }, take });
  }
}

export const newsRepository = new NewsRepository();
export const airdropRepository = new AirdropRepository();
export const guildRepository = new GuildRepository();
export const jobRepository = new JobRepository();
