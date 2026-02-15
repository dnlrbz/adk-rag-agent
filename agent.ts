import {LlmAgent} from '@google/adk';
import {ragQuery} from './tools/rag_query';
import {listCorpora} from './tools/list_corpora';
import {createCorpus} from './tools/create_corpus';
import {addData} from './tools/add_data';
import {getCorpusInfo} from './tools/get_corpus_info';
import {deleteCorpus} from './tools/delete_corpus';
import {deleteDocument} from './tools/delete_document';
import {instruction} from "./instruction";

export const rootAgent = new LlmAgent({
    name: 'RagAgent',
    model: 'gemini-2.0-flash-001',
    description: 'Vertex AI RAG Agent',
    tools: [
        ragQuery,
        listCorpora,
        createCorpus,
        addData,
        getCorpusInfo,
        deleteCorpus,
        deleteDocument,
    ],
    instruction,
});
