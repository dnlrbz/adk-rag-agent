/**
 * Configuration settings for the RAG Agent.
 * 
 * These settings are used by the various RAG tools.
 */

// Load environment variables
import 'dotenv/config';

// Vertex AI settings
export const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
export const LOCATION = process.env.GOOGLE_CLOUD_LOCATION;

// RAG settings
export const DEFAULT_CHUNK_SIZE = 512;
export const DEFAULT_CHUNK_OVERLAP = 100;
export const DEFAULT_TOP_K = 3;
export const DEFAULT_EMBEDDING_REQUESTS_PER_MIN = 1000;

