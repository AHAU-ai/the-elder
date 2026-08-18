-- migrations/011_corpus_passage_embedding_dims_note.sql
-- Documents and verifies a schema-file/DB drift found 2026-08-17 while
-- ingesting the first real corpus_passage rows (Mekubal voice, Zohar
-- Bereshit 1:1-2:5). scripts-resilience/schema.sql declared
-- corpus_passage.embedding as vector(1536); the actually deployed column
-- was (and remains) vector(1024). No ALTER here -- the DB was already
-- correct, only the schema file was wrong, and it has been corrected
-- in place. This migration just asserts the fact so a future drift
-- fails loudly at migration time instead of silently at ingest time.

DO $$
DECLARE
  actual_dims INTEGER;
BEGIN
  SELECT atttypmod INTO actual_dims
  FROM pg_attribute
  WHERE attrelid = 'corpus_passage'::regclass
    AND attname = 'embedding';

  IF actual_dims IS DISTINCT FROM 1024 THEN
    RAISE EXCEPTION
      'corpus_passage.embedding is vector(%), expected vector(1024) -- schema.sql and ingest.py (Voyage voyage-multilingual-2) assume 1024 dims. Update both together if this is an intentional change.',
      actual_dims;
  END IF;
END $$;
