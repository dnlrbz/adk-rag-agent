/**
 * Tool for adding new data sources to a Vertex AI RAG corpus.
 */

import {FunctionTool, ToolContext} from '@google/adk';
import {z} from 'zod';
import {
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    DEFAULT_EMBEDDING_REQUESTS_PER_MIN,
    LOCATION,
    PROJECT_ID
} from '../config';
import {checkCorpusExists, resolveCorpusResourceName, setCurrentCorpus} from './utils';
import {buildResponse, parsePaths, runImportOperations} from './shared';
import {VertexClient} from '../vertex-client';
import {google} from '@google-cloud/aiplatform/build/protos/protos';
import IRagFileTransformationConfig = google.cloud.aiplatform.v1.IRagFileTransformationConfig;
import IImportRagFilesConfig = google.cloud.aiplatform.v1.IImportRagFilesConfig;

export const addData = new FunctionTool({
    name: 'addData',
    description: 'Add new data sources to a Vertex AI RAG corpus. Supports Google Drive URLs and GCS paths.',
    parameters: z.object({
        corpus_name: z.string().describe('The name of the corpus to add data to. If empty, the current corpus will be used.'),
        paths: z.array(z.string()).describe('List of URLs or GCS paths to add to the corpus. Supported formats: Google Drive URLs, Google Docs/Sheets/Slides URLs, Google Cloud Storage paths (gs://...)'),
    }),
    execute: async ({corpus_name: corpusName, paths}, tool_context?: ToolContext) => {
        const toolContext = tool_context;
        console.log(`[add_data] Starting add_data for corpus: ${corpusName}`);

        if (!PROJECT_ID || !LOCATION) {
            return buildResponse('error', 'PROJECT_ID or LOCATION are not set. Please set environment variables.', {corpus_name: corpusName, paths});
        }

        const pathsInfo = parsePaths(paths || []);
        if (!pathsInfo.validated.length) {
            return buildResponse('error', 'No valid paths provided. Please provide Google Drive URLs or GCS paths.', {corpus_name: corpusName, invalid_paths: pathsInfo.invalid});
        }

        if (!toolContext || !(await checkCorpusExists(corpusName, toolContext))) {
            return buildResponse('error', `Corpus '${corpusName}' does not exist. Please create it first using the create_corpus tool.`, {corpus_name: corpusName, paths});
        }

        try {
            const client = new VertexClient().getClient();
            const resolved = await resolveCorpusResourceName(corpusName, client);
            if (!resolved) return buildResponse('error', `Corpus '${corpusName}' not found`, {corpus_name: corpusName});

            const transform: IRagFileTransformationConfig = { ragFileChunkingConfig: { fixedLengthChunking: { chunkSize: DEFAULT_CHUNK_SIZE, chunkOverlap: DEFAULT_CHUNK_OVERLAP } } };

            const configs: IImportRagFilesConfig[] = [];
            if (pathsInfo.driveFileIds.length) configs.push({ googleDriveSource: { resourceIds: pathsInfo.driveFileIds.map(id => ({ resourceType: google.cloud.aiplatform.v1.GoogleDriveSource.ResourceId.ResourceType.RESOURCE_TYPE_FILE, resourceId: id })) }, ragFileTransformationConfig: transform, maxEmbeddingRequestsPerMin: DEFAULT_EMBEDDING_REQUESTS_PER_MIN });

            const totalAdded = await runImportOperations(client, resolved.resourceName, configs);

            if (toolContext && !toolContext.state.get('current_corpus')) setCurrentCorpus(corpusName, toolContext);

            const conversionMsg = pathsInfo.conversions.length ? ' (Converted Google Docs URLs to Drive format)' : '';
            return buildResponse('success', `Successfully added ${totalAdded || pathsInfo.validated.length} file(s) to corpus '${corpusName}'${conversionMsg}`, { corpus_name: corpusName, files_added: totalAdded || pathsInfo.validated.length, paths: pathsInfo.validated, invalid_paths: pathsInfo.invalid.length ? pathsInfo.invalid : undefined, conversions: pathsInfo.conversions.length ? pathsInfo.conversions : undefined });
        } catch (e: any) {
            return buildResponse('error', `Error adding data to corpus: ${e instanceof Error ? e.message : String(e)}`, { corpus_name: corpusName, paths });
        }
     },
 });
