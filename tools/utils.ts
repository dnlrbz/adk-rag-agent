/**
 * Utility functions for the RAG tools.
 */

import {ToolContext} from '@google/adk';
import {LOCATION, PROJECT_ID} from '../config';
import {VertexClient} from "../vertex-client";
import {protos} from '@google-cloud/aiplatform';

/**
 * Convert a corpus name to its full resource name if needed.
 * Handles various input formats and ensures the returned name follows Vertex AI's requirements.
 */
export function getCorpusResourceName(corpusName: string): string {
    // If it's already a full resource name with the projects/locations/ragCorpora format
    if (corpusName.match(/^projects\/[^/]+\/locations\/[^/]+\/ragCorpora\/[^/]+$/)) {
        return corpusName;
    }

    // If it contains partial path elements, extract just the corpus ID
    const corpusId = corpusName.split('/').pop() || corpusName;
    // Remove any special characters that might cause issues
    const cleanId = corpusId.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Construct the standardized resource name
    return `projects/${PROJECT_ID}/locations/${LOCATION}/ragCorpora/${cleanId}`;
}

/**
 * Check if a corpus with the given name exists.
 */
interface CorpusMatchCandidate {
    value: string;
    preference: number;
}

export interface CorpusMatchResult {
    resourceName: string;
    displayName?: string;
}

export async function checkCorpusExists(
    corpusName: string,
    toolContext: ToolContext,
): Promise<boolean> {
    if (!PROJECT_ID || !LOCATION) {
        console.warn(`[checkCorpusExists] PROJECT_ID or LOCATION not set, cannot check corpus existence`);
        return false;
    }

    console.log('WILL CHECK CORPUS EXISTS FOR:', corpusName);

    if (toolContext?.state?.get(`corpus_exists_${corpusName}`)) {
        console.log(`[checkCorpusExists] Found in state cache`);
        return true;
    }


    try {
        const corpusResourceName = getCorpusResourceName(corpusName);
        console.log(`[checkCorpusExists] Resource name: ${corpusResourceName}`);

        // Initialize the client with regional endpoint
        const client = new VertexClient().getClient();
        const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;

        console.log('[checkCorpusExists] Listing corpora under parent:', parent);
        // List all corpora and check if this one exists
        const [corpora] = await client.listRagCorpora({
            parent: parent,
        });

        console.log(`[checkCorpusExists] Found ${corpora.length} corpora`);

        for (const corpus of corpora) {
            if (
                corpus.name === corpusResourceName ||
                corpus.displayName === corpusName
            ) {
                // Update state
                if (toolContext?.state) {
                    toolContext.state.set(`corpus_exists_${corpusName}`, true);
                    // Also set this as the current corpus if no current corpus is set
                    if (!toolContext.state.get('current_corpus')) {
                        toolContext.state.set('current_corpus', corpusName);
                    }
                }
                console.log(`[checkCorpusExists] Corpus found: ${corpus.name}`);
                return true;
            }
        }

        console.log(`[checkCorpusExists] Corpus not found`);
        return false;
    } catch (error) {
        console.error(`[checkCorpusExists] Error checking if corpus exists:`, error);
        // If we can't check, assume it doesn't exist
        return false;
    }
}

/**
 * Find the best matching corpus for the provided name using case-insensitive substring matching.
 */
export async function findBestMatchingCorpus(
    corpusName: string,
    clientParam?: any,
): Promise<CorpusMatchResult | null> {
    const normalizedQuery = corpusName?.trim().toLowerCase();
    if (!normalizedQuery) {
        return null;
    }

    if (!PROJECT_ID || !LOCATION) {
        console.warn('[findBestMatchingCorpus] PROJECT_ID or LOCATION not set, cannot resolve corpus.');
        return null;
    }

    try {
        const client = clientParam || new VertexClient().getClient();
        const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;
        const [corpora] = await client.listRagCorpora({ parent });

        let bestMatch: CorpusMatchResult | null = null;
        let bestScore = -Infinity;

        for (const corpus of corpora) {
            const resourceName = corpus.name || '';
            const displayName = corpus.displayName || '';
            const resourceId = resourceName.split('/').pop() || resourceName;

            const candidates: CorpusMatchCandidate[] = [
                { value: displayName, preference: 30 },
                { value: resourceId, preference: 20 },
                { value: resourceName, preference: 10 },
            ];

            for (const candidate of candidates) {
                const normalizedCandidate = (candidate.value || '').toLowerCase();
                const index = normalizedCandidate.indexOf(normalizedQuery);

                if (index === -1) continue;

                const score = normalizedQuery.length * 100 + candidate.preference - index;

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        resourceName,
                        displayName: displayName || undefined,
                    };
                }
            }
        }

        return bestMatch;
    } catch (error) {
        console.error('[findBestMatchingCorpus] Error listing corpora:', error);
        return null;
    }
}

/**
 * Set the current corpus in the tool context state.
 */
export function setCurrentCorpus(corpusName: string, toolContext: ToolContext): boolean {
    // Check if corpus exists first (this will update state if found)
    // Note: This is a simplified version - ideally we'd await check_corpus_exists
    // but since this function is synchronous, we'll just set it if context is available
    if (toolContext?.state) {
        toolContext.state.set('current_corpus', corpusName);
        return true;
    }
    return false;
}

/**
 * Convert protobuf Timestamp to ISO string.
 */
export const timestampToString = (ts: protos.google.protobuf.ITimestamp | null | undefined): string =>
    ts ? new Date(Number(ts.seconds || 0) * 1000 + (ts.nanos || 0) / 1000000).toISOString() : '';

/**
 * Resolve a corpus resource name using either the provided client or a new VertexClient.
 * Returns an object with resourceName and optional displayName, or null if not found.
 */
export async function resolveCorpusResourceName(corpusName: string, clientParam?: any): Promise<{ resourceName: string; displayName?: string } | null> {
    // If it's already a full resource name with the projects/locations/ragCorpora format
    if (corpusName.match(/^projects\/[^/]+\/locations\/[^/]+\/ragCorpora\/[^/]+$/)) {
        return { resourceName: corpusName };
    }

    try {
        const client = clientParam || new VertexClient().getClient();
        const parent = `projects/${PROJECT_ID}/locations/${LOCATION}`;
        const [corpora] = await client.listRagCorpora({ parent });

        const constructed = getCorpusResourceName(corpusName);
        const found = corpora.find((c: any) => c.name === constructed) || corpora.find((c: any) => c.displayName === corpusName);
        if (!found?.name) return null;
        return { resourceName: found.name, displayName: found.displayName };
    } catch (err) {
        console.error('[resolveCorpusResourceName] Error resolving corpus resource name:', err);
        return null;
    }
}

/**
 * Mark the "corpus_exists_<name>" state to false if present.
 */
export function invalidateCorpusExistsState(corpusName: string, toolContext: ToolContext | undefined): void {
    if (!toolContext?.state) return;
    const stateKey = `corpus_exists_${corpusName}`;
    if (toolContext.state.get(stateKey)) {
        toolContext.state.set(stateKey, false);
    }
}
