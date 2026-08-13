from sqlalchemy import (
    Column, String, Text, Integer, DateTime, ForeignKey, ARRAY, func
)
from sqlalchemy.dialects.postgresql import UUID
import uuid
from database import Base


def _uuid():
    return uuid.uuid4()


class Paper(Base):
    __tablename__ = "papers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    title = Column(Text, nullable=False)
    authors = Column(ARRAY(Text))
    abstract = Column(Text)
    source_type = Column(String(10))   # 'pdf', 'arxiv', 'doi', 'url'
    source_id = Column(String(255))
    upload_date = Column(DateTime, default=func.now())
    added_by = Column(String(255))
    thumbnail_url = Column(Text)
    file_url = Column(Text)

    # Tier 1: reading status & progress tracking
    reading_status = Column(String(20), default="not_started")  # not_started|reading|reviewed|completed
    started_reading_at = Column(DateTime)
    last_read_at = Column(DateTime)
    completed_reading_at = Column(DateTime)

    # Tier 1: keyword extraction + readability/complexity
    keywords = Column(ARRAY(Text))
    readability_score = Column(Integer)          # 0-100
    complexity_level = Column(String(20))        # easy|medium|hard
    page_count = Column(Integer)
    reading_time_minutes = Column(Integer)
    # Tier 2.4: quality & rigor assessment
    rigor_score = Column(Integer)               # 0-100
    bias_risk = Column(String(20))               # low|medium|high
    # Tier 3.5: reproducibility checker
    reproducibility_score = Column(Integer)       # 0-100
    quality_flags = Column(ARRAY(Text))          # list of flag descriptions


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    executive_summary = Column(Text)
    detailed_summary = Column(Text)
    key_findings = Column(ARRAY(Text))
    generated_at = Column(DateTime, default=func.now())
    model_used = Column(String(50))


class KeyElements(Base):
    __tablename__ = "key_elements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    problem = Column(Text)
    methodology = Column(Text)
    results = Column(Text)
    limitations = Column(Text)
    contributions = Column(Text)
    future_work = Column(Text)
    extracted_at = Column(DateTime, default=func.now())


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    chunk_text = Column(Text, nullable=False)
    page_number = Column(Integer)
    # Embedding stored as a JSON-encoded list of floats (backend-agnostic:
    # works on any Postgres, no pgvector extension required).
    embedding = Column(Text)
    chunk_order = Column(Integer)


class QAHistory(Base):
    __tablename__ = "qa_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text)
    cited_pages = Column(ARRAY(Integer))
    created_at = Column(DateTime, default=func.now())


class Collection(Base):
    __tablename__ = "collections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name = Column(Text, nullable=False, unique=True)
    description = Column(Text)
    category = Column(String(50))
    created_at = Column(DateTime, default=func.now())


class CollectionPaper(Base):
    __tablename__ = "collection_papers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    collection_id = Column(UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)


class Note(Base):
    __tablename__ = "notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    note_text = Column(Text)
    tags = Column(ARRAY(Text))
    created_at = Column(DateTime, default=func.now())


class Activity(Base):
    __tablename__ = "activity"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50))   # 'upload', 'analyze', 'question', 'tag', 'favorite'
    details = Column(Text)
    timestamp = Column(DateTime, default=func.now())


class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    paper_id = Column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    page_number = Column(Integer)
    color = Column(String(20), default="yellow")
    note = Column(Text)
    created_at = Column(DateTime, default=func.now())


class ResearchQuestion(Base):
    __tablename__ = "research_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    collection_id = Column(UUID(as_uuid=True), ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    hypothesis = Column(Text)
    status = Column(String(20), default="active")   # active|resolved|abandoned
    paper_ids = Column(ARRAY(Text))
    created_at = Column(DateTime, default=func.now())
