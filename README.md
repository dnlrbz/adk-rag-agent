![RAG Agent](https://google.github.io/adk-docs/assets/agent-development-kit.png)

# Vertex AI RAG Agent

This project wires a Gemini-based LLM into Vertex AI’s Retrieval-Augmented Generation workflow so the agent can manage corpora, keep knowledge up to date, and answer questions grounded in that data.

## What it can do
- Query any corpus to answer a user question via the `rag_query` tool.
- List available corpora so you know what data is accessible (`list_corpora`).
- Create, describe, and delete corpora (`create_corpus`, `get_corpus_info`, `delete_corpus`).
- Add new documents and remove outdated ones from corpora (`add_data`, `delete_document`).

## Quick start
1. `npm install`
2. `npm run web` to launch the RAG agent via web interface.

## How to upload and query documents
The agent is operable with human instructions through the web interface of ADK. To upload and query documents, follow these steps:

1. Create a corpus using the `create_corpus` tool, providing a unique name.
2. Feed a link to Google Drive Document with any content, and the agent will automatically ingest it into the corpus.
3. Use the `list_corpora` tool to confirm your corpus is ready, then ask questions referencing that corpus with `rag_query`.
