-- ============================================================
-- Research Paper Analysis Agent — Database Schema
-- Target: any Postgres (local or Neon). No pgvector required:
-- embeddings are stored as JSON text and compared in Python.
-- Run once after creating the database.
-- ============================================================

-- Papers table
CREATE TABLE IF NOT EXISTS papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    authors TEXT[],
    abstract TEXT,
    source_type VARCHAR(10),           -- 'pdf', 'arxiv', 'doi', 'url'
    source_id VARCHAR(255),            -- arXiv ID, DOI, URL, or file key
    upload_date TIMESTAMP DEFAULT NOW(),
    added_by VARCHAR(255),
    thumbnail_url TEXT,
    file_url TEXT,
    -- Tier 1: reading status & progress tracking
    reading_status VARCHAR(20) DEFAULT 'not_started',  -- not_started|reading|reviewed|completed
    started_reading_at TIMESTAMP,
    last_read_at TIMESTAMP,
    completed_reading_at TIMESTAMP,
    -- Tier 1: keyword extraction + readability/complexity
    keywords TEXT[],
    readability_score INT,                       -- 0-100
    complexity_level VARCHAR(20),               -- easy|medium|hard
    page_count INT,
    reading_time_minutes INT,
    -- Tier 2.4: quality & rigor assessment
    rigor_score INT,                            -- 0-100
    bias_risk VARCHAR(20),                      -- low|medium|high
    -- Tier 3.5: reproducibility checker
    reproducibility_score INT,                  -- 0-100
    quality_flags TEXT[]
);

-- Summaries table (versioned)
CREATE TABLE IF NOT EXISTS summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    executive_summary TEXT,
    detailed_summary TEXT,
    key_findings TEXT[],
    generated_at TIMESTAMP DEFAULT NOW(),
    model_used VARCHAR(50)
);

-- Key elements (structured extraction)
CREATE TABLE IF NOT EXISTS key_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    problem TEXT,
    methodology TEXT,
    results TEXT,
    limitations TEXT,
    contributions TEXT,
    future_work TEXT,
    extracted_at TIMESTAMP DEFAULT NOW()
);

-- Embeddings (chunked text). The embedding vector is stored as JSON text
-- (a list of floats) and compared in Python — no pgvector needed.
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    chunk_text TEXT NOT NULL,
    page_number INT,
    embedding TEXT,                    -- JSON-encoded 3072-dim Gemini vector
    chunk_order INT
);

-- Q&A and chat history
CREATE TABLE IF NOT EXISTS qa_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT,
    cited_pages INT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Collections/folders
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Collection membership
CREATE TABLE IF NOT EXISTS collection_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    UNIQUE(collection_id, paper_id)
);

-- Tags and notes
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    note_text TEXT,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    action VARCHAR(50),               -- 'upload', 'analyze', 'question', 'tag', 'favorite'
    details TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Highlights (inline passage marking)
CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    page_number INT,
    color VARCHAR(20) DEFAULT 'yellow',
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Research questions & hypotheses (Tier 3.1)
CREATE TABLE IF NOT EXISTS research_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    hypothesis TEXT,
    status VARCHAR(20) DEFAULT 'active',    -- active|resolved|abandoned
    paper_ids TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_paper_source ON papers(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_chunk_paper ON chunks(paper_id);
CREATE INDEX IF NOT EXISTS idx_qa_paper ON qa_history(paper_id);
CREATE INDEX IF NOT EXISTS idx_activity_paper ON activity(paper_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_collection_paper ON collection_papers(paper_id);
