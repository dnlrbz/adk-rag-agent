/**
 * Tool for deleting a Vertex AI RAG corpus when it's no longer needed.
 */

import {FunctionTool, ToolContext} from '@google/adk';
import {z} from 'zod';
import {LOCATION, PROJECT_ID} from '../config';
import {checkCorpusExists, invalidateCorpusExistsState, resolveCorpusResourceName} from './utils';
import {VertexClient} from '../vertex-client';
import {google} from '@google-cloud/aiplatform/build/protos/protos';
import {buildResponse} from './shared';
import IDeleteRagCorpusRequest = google.cloud.aiplatform.v1.IDeleteRagCorpusRequest;

export const deleteCorpus = new FunctionTool({
    name: 'deleteCorpus',
    description: 'Delete a Vertex AI RAG corpus when it\'s no longer needed.',
    parameters: z.object({
        corpus_name: z.string().describe('The full resource name of the corpus to delete. Preferably use the resource_name from list_corpora results.'),
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
            const resolved = await resolveCorpusResourceName(corpusName, client);
            if (!resolved) {
                return buildResponse('error', `Corpus '${corpusName}' not found`, { corpus_name: corpusName });
            }
            corpusResourceName = resolved.resourceName;

            const [operation] = await client.deleteRagCorpus({
                name: corpusResourceName,
            } as IDeleteRagCorpusRequest);
            await operation.promise();

            if (toolContext) {
                invalidateCorpusExistsState(corpusName, toolContext);
            }

            return buildResponse('success', `Successfully deleted corpus '${corpusName}'`, { corpus_name: corpusName });
        } catch (error) {
            return buildResponse('error', `Error deleting corpus: ${error instanceof Error ? error.message : String(error)}`, { corpus_name: corpusName });
        }
    },
});
