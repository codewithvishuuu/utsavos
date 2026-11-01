# Retrieval-augmented generation

## Status

Not implemented. No vector database, embedding model, document store or retrieval pipeline exists in this repository.

## Why not

The MVP has no corpus that would justify retrieval:

- Vendor research is deferred.
- Quote extraction from PDFs or images is deferred.
- File uploads are deferred.
- The planning facts are structured rows, not documents. They are already available to the engine directly, and the AI receives a compact computed fact sheet rather than retrieved chunks.

Adding retrieval now would introduce a second source of truth, an embedding service, an index to operate, and a new prompt-injection surface, without improving any shipped feature. The deterministic engine and the fact sheet cover the three AI tasks.

## If it is added later

The following constraints should survive:

1. Retrieved text is untrusted data, never instructions.
2. Retrieval may supply context, never authoritative numbers. Money and dates still come from the engine.
3. Every claim shown to the user should carry a source reference.
4. Indexing must exclude guest contact details, vendor contacts, private notes and session data unless the user explicitly opts in.
5. An evaluation set must exist before the feature is called reliable.
6. The app must remain usable when retrieval or the model is unavailable.

Until those conditions are met, the honest answer is that UtsavOS has no RAG.
