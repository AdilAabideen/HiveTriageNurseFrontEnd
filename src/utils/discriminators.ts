import { Discriminator } from '../types/encounter';

/**
 * Transforms Neo4j query results into the Discriminator format
 * This function should be called from a backend API that uses Neo4j MCP
 */
export const transformNeo4jDiscriminators = (neo4jResults: any[]): Record<string, Discriminator[]> => {
  const result: Record<string, Discriminator[]> = {};

  neo4jResults.forEach((row: any) => {
    const presentationId = row['p.presentation_id'] || row.presentation_id;
    if (!presentationId) return;

    if (!result[presentationId]) {
      result[presentationId] = [];
    }

    const discriminator: Discriminator = {
      discriminator_id: row['d.discriminator_id'] || row.discriminator_id,
      label: row['discriminator_label'] || row.label,
      definition: row['d.definition'] || row.definition,
      confidence: row['d.confidence'] || row.confidence,
      tier: row['r.tier'] || row.tier,
      tier_min: row['d.tier_min'] || row.tier_min,
      rationale: row['d.rationale'] || row.rationale || null,
      primary_source: row['d.primary_source'] || row.primary_source || null,
    };

    result[presentationId].push(discriminator);
  });

  // Sort discriminators by tier and confidence
  Object.keys(result).forEach(presentationId => {
    result[presentationId].sort((a, b) => {
      if (a.tier !== b.tier) {
        return parseInt(a.tier) - parseInt(b.tier);
      }
      return b.confidence - a.confidence;
    });
  });

  return result;
};

/**
 * Fetches discriminators from Neo4j via backend API
 * In production, this would call: /api/discriminators?presentationIds=...
 */
export const fetchDiscriminatorsFromAPI = async (
  presentationIds: string[]
): Promise<Record<string, Discriminator[]>> => {
  if (presentationIds.length === 0) {
    return {};
  }

  try {
    // TODO: Replace with actual API endpoint
    // const response = await fetch(`/api/discriminators?presentationIds=${presentationIds.join(',')}`);
    // const data = await response.json();
    // return transformNeo4jDiscriminators(data);
    
    // For now, return empty (will be populated by backend API)
    return {};
  } catch (error) {
    console.error('Error fetching discriminators from API:', error);
    return {};
  }
};

