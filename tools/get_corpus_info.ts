/**
 * Tool for retrieving detailed information about a specific RAG corpus.
 */

import {FunctionTool, ToolContext} from '@google/adk';
import {z} from 'zod';
import {LOCATION, PROJECT_ID} from '../config';
import {checkCorpusExists, resolveCorpusResourceName, timestampToString} from './utils';
import {VertexClient} from '../vertex-client';
import {buildResponse} from './shared';

export const getCorpusInfo = new FunctionTool({
    name: 'getCorpusInfo',
    description: 'Get detailed information about a specific RAG corpus, including its files.',
    parameters: z.object({
        corpus_name: z.string().describe('The full resource name of the corpus to get information about. Preferably use the resource_name from list_corpora results.'),
    }),
    execute: async ({corpus_name: corpusName}, tool_context?: ToolContext) => {
        const toolContext = tool_context;
        if (!PROJECT_ID || !LOCATION) {
            return buildResponse('error', 'PROJECT_ID or LOCATION are not set. Please set environment variables.', { corpus_name: corpusName });
        }

        if (toolContext && !(await checkCorpusExists(corpusName, toolContext))) {
            return buildResponse('error', `Corpus '${corpusName}' does not exist`, { corpus_name: corpusName });
        }

        try {
            const client = new VertexClient().getClient();
            let corpusResourceName: string;
            let corpusDisplayName = corpusName;
            const resolved = await resolveCorpusResourceName(corpusName, client);
            if (!resolved) {
                return buildResponse('error', `Corpus '${corpusName}' not found`, { corpus_name: corpusName });
            }
            corpusResourceName = resolved.resourceName;
            corpusDisplayName = resolved.displayName || corpusName;

            const [corpus] = await client.getRagCorpus({name: corpusResourceName});
            corpusDisplayName = corpus.displayName || corpusDisplayName;

            const fileDetails = [];
            try {
                const [files] = await client.listRagFiles({parent: corpusResourceName});
                for (const ragFile of files) {
                    fileDetails.push({
                        file_id: ragFile.name?.split('/').pop() || '',
                        display_name: ragFile.displayName || '',
                        create_time: timestampToString(ragFile.createTime),
                        update_time: timestampToString(ragFile.updateTime),
                    });
                }
            } catch {
                // Continue without file details
            }

            return buildResponse('success', `Successfully retrieved information for corpus '${corpusDisplayName}'`, { corpus_name: corpusResourceName, corpus_display_name: corpusDisplayName, file_count: fileDetails.length, files: fileDetails });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return buildResponse('error', `Error getting corpus information: ${errorMessage}`, { corpus_name: corpusName });
        }
    },
});
