/**
 * Tool for listing all available Vertex AI RAG corpora.
 */

import {FunctionTool} from '@google/adk';
import {z} from 'zod';
import {LOCATION, PROJECT_ID} from '../config.js';
import {VertexClient} from "../vertex-client.js";
import {timestampToString,} from './utils.js';
import {buildResponse} from './shared.js';

export const listCorpora = new FunctionTool({
    name: 'listCorpora',
    description: 'List all available Vertex AI RAG corpora.',
    parameters: z.object({}),
    execute: async () => {
        if (!PROJECT_ID || !LOCATION) {
            return buildResponse('error', 'PROJECT_ID or LOCATION are not set. Please set environment variables.', { corpora: [] });
        }

        try {
            const client = new VertexClient().getClient();

            const [corpora] = await client.listRagCorpora({
                parent: `projects/${PROJECT_ID}/locations/${LOCATION}`,
            }, { maxRetries: 3 });

            const corpusInfo = corpora.map((corpus: any) => ({
                resource_name: corpus.name || '',
                display_name: corpus.displayName || '',
                create_time: timestampToString(corpus.createTime),
                update_time: timestampToString(corpus.updateTime),
            }));

            return buildResponse('success', `Found ${corpusInfo.length} available corpora`, { corpora: corpusInfo });
        } catch (error) {
            return buildResponse('error', `Error listing corpora: ${error instanceof Error ? error.message : String(error)}`, { corpora: [] });
        }
    },
});
