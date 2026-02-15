/**
 * Tool for creating a new Vertex AI RAG corpus.
 */

import {FunctionTool, ToolContext} from '@google/adk';
import {z} from 'zod';
import {LOCATION, PROJECT_ID} from '../config';
import {checkCorpusExists, setCurrentCorpus} from './utils';
import {buildResponse} from './shared';
import {google} from "@google-cloud/aiplatform/build/protos/protos";
import {VertexClient} from "../vertex-client";
import IRagCorpus = google.cloud.aiplatform.v1.IRagCorpus;
import ICreateRagCorpusRequest = google.cloud.aiplatform.v1.ICreateRagCorpusRequest;

export const createCorpus = new FunctionTool({
    name: 'createCorpus',
    description: 'Create a new Vertex AI RAG corpus with the specified name.',
    parameters: z.object({
        corpus_name: z.string().describe('The name for the new corpus'),
    }),
    execute: async ({corpus_name: corpusName}, tool_context?: ToolContext) => {
        const toolContext = tool_context;
        console.log(`[create_corpus] Starting corpus creation for: ${corpusName}`);

        const projectId = PROJECT_ID;
        const location = LOCATION;
        if (!projectId || !location) {
            console.error('[create_corpus] PROJECT_ID or LOCATION are not set');
            return buildResponse('error', 'PROJECT_ID or LOCATION are not set. Please set environment variables.', { corpus_name: corpusName, corpus_created: false });
        }

        // Check if corpus already exists
        if (toolContext && await checkCorpusExists(corpusName, toolContext)) {
            console.log(`[create_corpus] Corpus '${corpusName}' already exists`);
            return buildResponse('info', `Corpus '${corpusName}' already exists`, { corpus_name: corpusName, corpus_created: false });
        }

        try {
            // Clean corpus name for use as display name
            const displayName = corpusName.replace(/[^a-zA-Z0-9_-]/g, '_');
            console.log(`[create_corpus] Cleaned display name: ${displayName}`);

            // Initialize the Vertex AI RAG Data Service client with regional endpoint
            const apiEndpoint = `${location}-aiplatform.googleapis.com`;
            const client = new VertexClient().getClient();
            console.log(`[create_corpus] Initialized client for project: ${projectId}, location: ${location}, endpoint: ${apiEndpoint}`);

            // Create the corpus request with embedding model configuration
            const parent = `projects/${projectId}/locations/${location}`;
            const ragCorpus: IRagCorpus = {
                displayName: displayName,
            };

            const request: ICreateRagCorpusRequest = {
                parent: parent,
                ragCorpus: ragCorpus,
            };

            console.log(`[create_corpus] Creating corpus with request:`, JSON.stringify(request, null, 2));

            // Create the corpus (this returns a long-running operation)
            const [operation] = await client.createRagCorpus(request);
            console.log(`[create_corpus] Operation started: ${operation.name}`);

            // Wait for the operation to complete
            const [response] = await operation.promise();
            console.log(`[create_corpus] Corpus created successfully: ${response.name}`);

            // Update state to track corpus existence
            if (toolContext) {
                toolContext.state.set(`corpus_exists_${corpusName}`, true);
                // Set this as the current corpus
                setCurrentCorpus(corpusName, toolContext);
                console.log(`[create_corpus] Updated tool context state`);
            }

            return buildResponse('success', `Successfully created corpus '${corpusName}'`, { corpus_name: response.name || corpusName, display_name: response.displayName || displayName, corpus_created: true });
        } catch (error) {
            console.error(`[create_corpus] Error creating corpus:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return buildResponse('error', `Error creating corpus: ${errorMessage}`, { corpus_name: corpusName, corpus_created: false });
        }
    },
});
