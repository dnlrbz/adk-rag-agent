import {VertexRagDataServiceClient} from "@google-cloud/aiplatform";
import {google} from "@google-cloud/aiplatform/build/protos/protos";
import IImportRagFilesConfig = google.cloud.aiplatform.v1.IImportRagFilesConfig;

export type ToolResult = Record<string, any>;

export function buildResponse(status: 'success' | 'error' | 'info' | 'warning', message: string, extra?: Record<string, any>): ToolResult {
    return {
        status,
        message,
        ...(extra || {}),
    };
}

export const buildSuccess = (message: string, extra?: Record<string, any>) => buildResponse('success', message, extra);
export const buildError = (message: string, extra?: Record<string, any>) => buildResponse('error', message, extra);

export type ParsedPaths = {
    validated: string[];
    invalid: string[];
    conversions: string[];
    gcsPaths: string[];
    driveFileIds: string[];
};

export function parsePaths(paths: string[]): ParsedPaths {
    const validated: string[] = [];
    const invalid: string[] = [];
    const conversions: string[] = [];
    const gcsPaths: string[] = [];
    const driveFileIds: string[] = [];

    const docsRe = /https:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/;
    const driveRe = /https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)(?:\/|$)/;

    for (const p of (paths || [])) {
        if (!p || p.trim() === '') {
            invalid.push(`${p} (Not a valid or empty string)`);
            continue;
        }
        const docsMatch = p.match(docsRe);
        if (docsMatch && docsMatch[1]) {
            const id = docsMatch[1];
            const driveUrl = `https://drive.google.com/file/d/${id}/view`;
            validated.push(driveUrl);
            driveFileIds.push(id);
            conversions.push(`${p} → ${driveUrl}`);
            continue;
        }
        const driveMatch = p.match(driveRe);
        if (driveMatch && driveMatch[1]) {
            const id = driveMatch[1];
            const driveUrl = `https://drive.google.com/file/d/${id}/view`;
            validated.push(driveUrl);
            driveFileIds.push(id);
            if (driveUrl !== p) conversions.push(`${p} → ${driveUrl}`);
            continue;
        }
        if (p.startsWith('gs://')) {
            validated.push(p);
            gcsPaths.push(p);
            continue;
        }
        invalid.push(`${p} (Invalid format)`);
    }

    return {validated, invalid, conversions, gcsPaths, driveFileIds};
}

export async function runImportOperations(client: VertexRagDataServiceClient, parent: string, configs: Array<IImportRagFilesConfig>): Promise<number> {
    const operations = [];
    for (const cfg of configs) {
        const [op] = await client.importRagFiles({ parent, importRagFilesConfig: cfg });
        if (op) operations.push(op);
    }

    let total = 0;
    for (const op of operations) {
        try {
            const [resp] = await op.promise();
            total += (resp as any).importedRagFilesCount || 0;
        } catch {
            // ignore individual operation errors here; caller may handle
        }
    }

    return total;
}
