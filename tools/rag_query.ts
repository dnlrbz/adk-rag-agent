/**
 * Tool for querying Vertex AI RAG corpora and retrieving relevant information.
 */

import {FunctionTool, ToolContext} from '@google/adk';
import {z} from 'zod';
import {VertexRagServiceClient} from '@google-cloud/aiplatform';

import {DEFAULT_TOP_K, LOCATION, PROJECT_ID,} from '../config';
import {findBestMatchingCorpus, setCurrentCorpus} from './utils';
import {buildResponse} from './shared';
import {google} from "@google-cloud/aiplatform/build/protos/protos";
import IRetrieveContextsRequest = google.cloud.aiplatform.v1.IRetrieveContextsRequest;

export const ragQuery = new FunctionTool({
    name: 'ragQuery',
    description: 'Query a Vertex AI RAG corpus with a user question and return relevant information.',
    parameters: z.object({
        corpus_name: z
            .string()
            .describe(
                'The name of the corpus to query. If empty, the current corpus will be used. Preferably use the resource_name from list_corpora results.',
            ),
        query: z.string().describe('The text query to search for in the corpus'),
    }),
    execute: async ({ corpus_name: corpusName, query }, tool_context?: ToolContext) => {
        const toolContext = tool_context;
        const trimmedQuery = query?.trim();
        if (!trimmedQuery) {
            return buildResponse('error', 'A non-empty query is required.', { query: query, corpus_name: corpusName });
        }

        const projectId = PROJECT_ID;
        const location = LOCATION;
        if (!projectId || !location) {
            return buildResponse('error', 'PROJECT_ID or LOCATION are not set. Please set environment variables.', { query: trimmedQuery, corpus_name: corpusName });
        }

        if (!toolContext) {
            return buildResponse('error', 'Tool context is required for rag_query', { query: trimmedQuery, corpus_name: corpusName });
        }

        const stateCorpus: string | undefined = toolContext.state?.get?.('current_corpus');
        const resolvedCorpusInput = corpusName?.trim() || stateCorpus;

        if (!resolvedCorpusInput) {
            return buildResponse(
                'error',
                'No corpus specified. Provide a corpus_name or set the current_corpus in the tool context.',
                { query: trimmedQuery, corpus_name: corpusName },
            );
        }

        const match = await findBestMatchingCorpus(resolvedCorpusInput);

        if (!match) {
            return buildResponse(
                'error',
                `No corpus matching '${resolvedCorpusInput}' was found. Please create it using the create_corpus tool or list available corpora.`,
                { query: trimmedQuery, corpus_name: resolvedCorpusInput },
            );
        }

        const corpusResourceName = match.resourceName;
        const canonicalCorpusName = match.displayName || match.resourceName;

        const ragServiceClient = new VertexRagServiceClient({
            projectId,
            apiEndpoint: `${location}-aiplatform.googleapis.com`,
        });

        try {
            const parent = `projects/${projectId}/locations/${location}`;
            const request: IRetrieveContextsRequest = {
                parent,
                vertexRagStore: {
                    ragResources: [
                        {
                            ragCorpus: corpusResourceName,
                        },
                    ],
                },
                query: {
                    text: trimmedQuery,
                    ragRetrievalConfig: {
                        topK: DEFAULT_TOP_K,
                    },
                },
            };

            const [response] = await ragServiceClient.retrieveContexts(request);
            const contexts = response.contexts?.contexts ?? [];
            const results = contexts.map((ctx) => ({
                source_uri: ctx.sourceUri || '',
                source_name: ctx.sourceDisplayName || '',
                text: ctx.text || '',
                score: ctx.score ?? 0,
            }));

            if (!results.length) {
                return buildResponse('warning', `No results found in corpus '${canonicalCorpusName}' for query: '${trimmedQuery}'`, {
                    query: trimmedQuery,
                    corpus_name: canonicalCorpusName,
                    results: [],
                    results_count: 0,
                });
            }

            if (toolContext.state) {
                setCurrentCorpus(canonicalCorpusName, toolContext);
            }
            return buildResponse('success', `Successfully queried corpus '${canonicalCorpusName}'`, {
                query: trimmedQuery,
                corpus_name: canonicalCorpusName,
                results,
                results_count: results.length,
            });
        } catch (error) {
            console.error('[rag_query] Error retrieving contexts:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return buildResponse('error', `Error querying corpus: ${errorMessage}`, { query: trimmedQuery, corpus_name: canonicalCorpusName });
        }
    },
});
