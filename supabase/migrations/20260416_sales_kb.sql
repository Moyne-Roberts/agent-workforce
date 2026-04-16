-- Migration: Sales Knowledge Base (pgvector)
-- Created: 2026-04-16
-- Purpose: Semantic search KB built from 34K sales emails (Smeba Brandbeveiliging)
-- Agents query this via Supabase API call as a tool — NOT built in Orq.ai

-- pgvector extension (may already be enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- TABLE: sales.kb_chunks
-- One row per embeddable unit:
--   email_qa_pair   — inbound email + outbound reply (gold standard)
--   email_outbound  — standalone outbound (tone/style reference)
--   document_chunk  — future: PDF/Word chunks (product catalogs, procedures)
-- ============================================================
CREATE TABLE IF NOT EXISTS sales.kb_chunks (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_type  TEXT    NOT NULL CHECK (chunk_type IN ('email_qa_pair', 'email_outbound', 'email_inbound', 'document_chunk')),
  source_type TEXT    NOT NULL DEFAULT 'email' CHECK (source_type IN ('email', 'document')),
  source_key  TEXT    NOT NULL UNIQUE,       -- idempotent upsert key
  content     TEXT    NOT NULL,              -- embedded text (also returned to agents)
  embedding   vector(1536),                  -- OpenAI text-embedding-3-small
  metadata    JSONB   DEFAULT '{}',          -- intent, category, customer, ids, doc info
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEX: HNSW for approximate nearest neighbour search
-- m=16, ef_construction=64 — good balance for <100K vectors
-- ============================================================
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_hnsw_idx
  ON sales.kb_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Partial index on chunk_type for filtered lookups
CREATE INDEX IF NOT EXISTS kb_chunks_chunk_type_idx ON sales.kb_chunks (chunk_type);

-- GIN index on metadata for intent/category filters
CREATE INDEX IF NOT EXISTS kb_chunks_metadata_gin_idx ON sales.kb_chunks USING gin (metadata);

-- ============================================================
-- FUNCTION: sales.search_kb
-- Called by Orq.ai agents as a Supabase tool.
-- Accepts an already-embedded query vector + optional filters.
-- Returns top N chunks sorted by cosine similarity.
-- ============================================================
CREATE OR REPLACE FUNCTION sales.search_kb(
  query_embedding vector(1536),
  intent_filter   TEXT    DEFAULT NULL,
  category_filter TEXT    DEFAULT NULL,
  chunk_types     TEXT[]  DEFAULT NULL,        -- e.g. ARRAY['email_qa_pair']
  match_count     INT     DEFAULT 5
)
RETURNS TABLE (
  id          UUID,
  chunk_type  TEXT,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.chunk_type,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM sales.kb_chunks c
  WHERE
    c.embedding IS NOT NULL
    AND (intent_filter   IS NULL OR c.metadata->>'intent'   = intent_filter)
    AND (category_filter IS NULL OR c.metadata->>'category' = category_filter)
    AND (chunk_types     IS NULL OR c.chunk_type = ANY(chunk_types))
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON TABLE sales.kb_chunks IS
  'Semantic search KB for Smeba sales email automation. Built from email Q&A pairs + outbound templates. Queryable via sales.search_kb().';

COMMENT ON FUNCTION sales.search_kb IS
  'ANN search over sales KB. Pass a pre-computed embedding vector. Filter by intent/category/chunk_type. Returns top N chunks with cosine similarity score.';
