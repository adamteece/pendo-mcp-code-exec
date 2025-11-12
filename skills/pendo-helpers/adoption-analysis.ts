import { activityQuery } from '../../servers/pendo/activityQuery.js';
import { searchEntities } from '../../servers/pendo/searchEntities.js';
import { accountQuery } from '../../servers/pendo/accountQuery.js';

export interface AdoptionMetrics {
  featureName: string;
  featureId: string;
  totalUsers: number;
  activeUsers: number;
  adoptionRate: number;
  avgEventsPerUser: number;
  totalEvents: number;
}

/**
 * Analyze feature adoption for a specific feature
 *
 * @example
 * ```typescript
 * const metrics = await analyzeFeatureAdoption({
 *   subId: 'your-sub-id',
 *   appId: 'your-app-id',
 *   featureName: 'Export Button',
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-31',
 *   segmentId: 'segment-123'
 * });
 * ```
 */
export async function analyzeFeatureAdoption(config: {
  subId: string;
  appId: string;
  featureName: string;
  startDate: string;
  endDate: string;
  segmentId?: string;
}): Promise<AdoptionMetrics> {
  // Find the feature
  const features = await searchEntities({
    subId: config.subId,
    appId: config.appId,
    itemType: 'feature',
    substring: config.featureName,
  });

  if (features.length === 0) {
    throw new Error(`Feature not found: ${config.featureName}`);
  }

  const feature = features[0];

  // Get activity data for the feature
  const activity = await activityQuery({
    subId: config.subId,
    appId: config.appId,
    entityType: 'feature',
    itemIds: [feature.id],
    startDate: config.startDate,
    endDate: config.endDate,
    period: 'dayRange',
  });

  // Get total users (from account query or visitor query depending on segmentId)
  let totalUsers = 0;

  if (config.segmentId) {
    const accountCount = await accountQuery({
      subId: config.subId,
      segmentId: config.segmentId,
      count: true,
    });
    totalUsers = accountCount.count || 0;
  } else {
    // Default: use all accounts
    const accounts = await accountQuery({
      subId: config.subId,
      select: ['accountId'],
    });
    totalUsers = accounts.length;
  }

  const activeUsers = activity.rows[0]?.uniqueVisitorCount || 0;
  const totalEvents = activity.rows[0]?.numEvents || 0;

  return {
    featureName: feature.name,
    featureId: feature.id,
    totalUsers,
    activeUsers,
    adoptionRate: totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0,
    avgEventsPerUser: activeUsers > 0 ? totalEvents / activeUsers : 0,
    totalEvents,
  };
}

/**
 * Compare adoption rates across multiple features
 */
export async function compareFeatureAdoption(config: {
  subId: string;
  appId: string;
  featureNames: string[];
  startDate: string;
  endDate: string;
}): Promise<AdoptionMetrics[]> {
  const results = await Promise.all(
    config.featureNames.map((featureName) =>
      analyzeFeatureAdoption({
        subId: config.subId,
        appId: config.appId,
        featureName,
        startDate: config.startDate,
        endDate: config.endDate,
      })
    )
  );

  // Sort by adoption rate descending
  return results.sort((a, b) => b.adoptionRate - a.adoptionRate);
}
