import {LlmAgent} from '@google/adk';
import {ragQuery} from './tools/rag_query.js';
import {listCorpora} from './tools/list_corpora.js';
import {createCorpus} from './tools/create_corpus.js';
import {addData} from './tools/add_data.js';
import {getCorpusInfo} from './tools/get_corpus_info.js';
import {deleteCorpus} from './tools/delete_corpus.js';
import {deleteDocument} from './tools/delete_document.js';
import {instruction} from "./instruction.js";

export const rootAgent = new LlmAgent({
    name: 'RagAgent',
    model: 'gemini-2.5-flash',
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
