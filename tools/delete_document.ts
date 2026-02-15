/**
 * Tool for deleting a specific document from a Vertex AI RAG corpus.
 */

import {FunctionTool, ToolContext} from '@google/adk';
import {google} from '@google-cloud/aiplatform/build/protos/protos';
import {z} from 'zod';
import {LOCATION, PROJECT_ID} from '../config';
import {checkCorpusExists, resolveCorpusResourceName} from './utils';
import {VertexClient} from '../vertex-client';
import {buildResponse} from './shared';
import IDeleteRagFileRequest = google.cloud.aiplatform.v1.IDeleteRagFileRequest;

export const deleteDocument = new FunctionTool({
    name: 'deleteDocument',
    description: 'Delete a specific document from a Vertex AI RAG corpus.',
    parameters: z.object({
        corpus_name: z.string().describe('The full resource name of the corpus containing the document. Preferably use the resource_name from list_corpora results.'),
        document_id: z.string().describe('The ID of the specific document/file to delete. This can be obtained from get_corpus_info results.'),
    }),
    execute: async ({corpus_name: corpusName, document_id: documentId}, tool_context?: ToolContext) => {
        const toolContext = tool_context;
        if (!PROJECT_ID || !LOCATION) {
            return buildResponse('error', 'PROJECT_ID or LOCATION are not set. Please set environment variables.', { corpus_name: corpusName, document_id: documentId });
        }

        if (toolContext && !(await checkCorpusExists(corpusName, toolContext))) {
            return buildResponse('error', `Corpus '${corpusName}' does not exist`, { corpus_name: corpusName, document_id: documentId });
        }

        try {
            const client = new VertexClient().getClient();
            const resolved = await resolveCorpusResourceName(corpusName, client);
            if (!resolved) {
                return buildResponse('error', `Corpus '${corpusName}' not found`, { corpus_name: corpusName, document_id: documentId });
            }
            const ragFilePath = `${resolved.resourceName}/ragFiles/${documentId}`;
            const [operation] = await client.deleteRagFile({
                name: ragFilePath,
            } as IDeleteRagFileRequest);
            await operation.promise();

            return buildResponse('success', `Successfully deleted document '${documentId}' from corpus '${corpusName}'`, { corpus_name: corpusName, document_id: documentId });
        } catch (error) {
            return buildResponse('error', `Error deleting document: ${error instanceof Error ? error.message : String(error)}`, { corpus_name: corpusName, document_id: documentId });
        }
    },
});
