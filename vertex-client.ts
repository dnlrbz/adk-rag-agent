import {VertexRagDataServiceClient} from "@google-cloud/aiplatform";
import {LOCATION, PROJECT_ID} from "./config";

export class VertexClient {
    private client?: VertexRagDataServiceClient;

    getClient(): VertexRagDataServiceClient {
        if (!PROJECT_ID || !LOCATION) {
            throw new Error("PROJECT_ID or LOCATION are not set. Please set environment variables.");
        }
        if (!this.client) {
            this.client = new VertexRagDataServiceClient({
                projectId: PROJECT_ID,
                apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
            });
        }
        return this.client;
    }
}
