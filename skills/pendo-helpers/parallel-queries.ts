import { activityQuery } from '../../servers/pendo/activityQuery.js';

/**
 * Execute multiple activity queries in parallel for better performance
 *
 * @example
 * ```typescript
 * const results = await getMultiPageActivity({
 *   subId: 'your-sub-id',
 *   appId: 'your-app-id',
 *   pageIds: ['page1', 'page2', 'page3'],
 *   startDate: '2025-01-01',
 *   endDate: '2025-01-31'
 * });
 * ```
 */
export async function getMultiPageActivity(config: {
  subId: string;
  appId: string;
  pageIds: string[];
  startDate: string;
  endDate: string;
}): Promise<any[]> {
  // Execute queries in parallel
  const promises = config.pageIds.map((pageId) =>
    activityQuery({
      subId: config.subId,
      appId: config.appId,
      entityType: 'page',
      itemIds: [pageId],
      startDate: config.startDate,
      endDate: config.endDate,
      period: 'dayRange',
    })
  );

  return await Promise.all(promises);
}

/**
 * Execute multiple activity queries for different entity types in parallel
 */
export async function getMultiEntityActivity(config: {
  subId: string;
  appId: string;
  entities: Array<{
    type: 'page' | 'feature' | 'guide' | 'trackType';
    ids: string[];
  }>;
  startDate: string;
  endDate: string;
}): Promise<Record<string, any[]>> {
  const promises = config.entities.map(async (entity) => {
    const result = await activityQuery({
      subId: config.subId,
      appId: config.appId,
      entityType: entity.type,
      itemIds: entity.ids,
      startDate: config.startDate,
      endDate: config.endDate,
      period: 'dayRange',
    });

    return { type: entity.type, data: result };
  });

  const results = await Promise.all(promises);

  // Convert to object keyed by entity type
  return results.reduce(
    (acc, { type, data }) => {
      acc[type] = data;
      return acc;
    },
    {} as Record<string, any[]>
  );
}

/**
 * Batch query with automatic chunking for large datasets
 */
export async function batchActivityQuery(config: {
  subId: string;
  appId: string;
  entityType: 'page' | 'feature' | 'guide' | 'trackType';
  itemIds: string[];
  startDate: string;
  endDate: string;
  batchSize?: number;
}): Promise<any[]> {
  const batchSize = config.batchSize || 10;
  const batches: string[][] = [];

  // Split itemIds into batches
  for (let i = 0; i < config.itemIds.length; i += batchSize) {
    batches.push(config.itemIds.slice(i, i + batchSize));
  }

  // Execute batches in parallel
  const promises = batches.map((batch) =>
    activityQuery({
      subId: config.subId,
      appId: config.appId,
      entityType: config.entityType,
      itemIds: batch,
      startDate: config.startDate,
      endDate: config.endDate,
      period: 'dayRange',
    })
  );

  const results = await Promise.all(promises);

  // Merge results
  return results.flatMap((result) => result.rows || []);
}
