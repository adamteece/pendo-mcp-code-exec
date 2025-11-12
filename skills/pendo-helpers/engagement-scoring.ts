import { activityQuery } from '../../servers/pendo/activityQuery.js';
import { accountQuery } from '../../servers/pendo/accountQuery.js';
import { visitorQuery } from '../../servers/pendo/visitorQuery.js';

export interface EngagementScore {
  accountId: string;
  score: number;
  factors: {
    frequency: number; // How often they use the product
    breadth: number; // How many features they use
    depth: number; // How deeply they use features
    recency: number; // How recently they used the product
  };
  risk: 'low' | 'medium' | 'high';
}

/**
 * Calculate engagement score for accounts
 *
 * @example
 * ```typescript
 * const scores = await calculateEngagementScores({
 *   subId: 'your-sub-id',
 *   appId: 'your-app-id',
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-31',
 *   accountIds: ['acc1', 'acc2']
 * });
 * ```
 */
export async function calculateEngagementScores(config: {
  subId: string;
  appId: string;
  startDate: string;
  endDate: string;
  accountIds?: string[];
}): Promise<EngagementScore[]> {
  // Get accounts
  const accounts = config.accountIds
    ? await Promise.all(
        config.accountIds.map((id) =>
          accountQuery({
            subId: config.subId,
            accountId: id,
          })
        )
      )
    : await accountQuery({
        subId: config.subId,
        select: ['accountId', 'metadata.auto.lastvisit'],
      });

  const accountList = Array.isArray(accounts) ? accounts : [accounts];

  // Get activity for each account in parallel
  const activityPromises = accountList.map((account) =>
    activityQuery({
      subId: config.subId,
      appId: config.appId,
      entityType: 'account',
      accountId: account.accountId,
      startDate: config.startDate,
      endDate: config.endDate,
      period: 'daily',
    })
  );

  const activities = await Promise.all(activityPromises);

  // Calculate scores
  return accountList.map((account, idx) => {
    const activity = activities[idx];
    const rows = activity.rows || [];

    // Calculate factors
    const frequency = calculateFrequency(rows);
    const breadth = calculateBreadth(rows);
    const depth = calculateDepth(rows);
    const recency = calculateRecency(account.metadata?.auto?.lastvisit);

    // Weighted score (0-100)
    // The weights below are intentionally unbalanced to emphasize usage frequency (0.3) over breadth (0.25), depth (0.25), and recency (0.2).
    // Adjust these weights if business priorities change or if empirical analysis suggests a different balance.
    const score =
      frequency * 0.3 + breadth * 0.25 + depth * 0.25 + recency * 0.2;

    // Determine risk level
    let risk: 'low' | 'medium' | 'high';
    if (score >= 70) risk = 'low';
    else if (score >= 40) risk = 'medium';
    else risk = 'high';

    return {
      accountId: account.accountId,
      score: Math.round(score),
      factors: {
        frequency: Math.round(frequency),
        breadth: Math.round(breadth),
        depth: Math.round(depth),
        recency: Math.round(recency),
      },
      risk,
    };
  });
}

/**
 * Calculate frequency score based on days active
 */
function calculateFrequency(activityRows: any[]): number {
  const daysActive = activityRows.filter((row) => row.numEvents > 0).length;
  const totalDays = activityRows.length || 1;

  return (daysActive / totalDays) * 100;
}

/**
 * Calculate breadth score based on number of unique features/pages used
 */
function calculateBreadth(activityRows: any[]): number {
  const uniqueItems = new Set(
    activityRows.map((row) => row.pageId || row.featureId).filter(Boolean)
  );

  // Assume 20 key features/pages is "full breadth"
  return Math.min((uniqueItems.size / 20) * 100, 100);
}

/**
 * Calculate depth score based on average events per session
 */
function calculateDepth(activityRows: any[]): number {
  const totalEvents = activityRows.reduce(
    (sum, row) => sum + (row.numEvents || 0),
    0
  );
  const totalDays = activityRows.filter((row) => row.numEvents > 0).length || 1;

  const avgEventsPerDay = totalEvents / totalDays;

  // Assume 50 events per active day is "full depth"
  return Math.min((avgEventsPerDay / 50) * 100, 100);
}

/**
 * Calculate recency score based on last visit
 */
function calculateRecency(lastVisit?: number): number {
  if (!lastVisit) return 0;

  const daysSinceLastVisit = (Date.now() - lastVisit) / (1000 * 60 * 60 * 24);

  if (daysSinceLastVisit <= 1) return 100;
  if (daysSinceLastVisit <= 7) return 80;
  if (daysSinceLastVisit <= 14) return 60;
  if (daysSinceLastVisit <= 30) return 40;
  if (daysSinceLastVisit <= 60) return 20;

  return 0;
}

/**
 * Find at-risk accounts based on engagement score
 */
export async function findAtRiskAccounts(config: {
  subId: string;
  appId: string;
  startDate: string;
  endDate: string;
  threshold?: number;
}): Promise<EngagementScore[]> {
  const scores = await calculateEngagementScores(config);

  const threshold = config.threshold || 40;

  return scores.filter((score) => score.score < threshold).sort((a, b) => a.score - b.score);
}
