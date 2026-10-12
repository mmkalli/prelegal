"""A user's saved documents. Every query is scoped to the user, so others' documents don't exist."""

import json
import sqlite3

from app.documents.spec import Registry
from app.documents.values import DocumentValues, document_title, progress
from app.schemas import ChatMessage, Document, DocumentSummary

MAX_DOCUMENTS = 100
# Older messages are dropped from storage beyond this; the model only sees the last MAX_HISTORY.
MAX_STORED_MESSAGES = 200

_COLUMNS = "id, document_type, title, values_json, messages_json, version, created_at, updated_at"


class ConflictError(Exception):
    """The document was saved by another request since it was read."""


class DocumentRepository:
    def __init__(self, conn: sqlite3.Connection, user_id: int, registry: Registry) -> None:
        self.conn = conn
        self.user_id = user_id
        self.registry = registry

    def summaries(self) -> list[DocumentSummary]:
        rows = self.conn.execute(
            f"SELECT {_COLUMNS} FROM documents WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
            (self.user_id,),
        ).fetchall()
        return [self._to_summary(row, DocumentValues.model_validate_json(row["values_json"])) for row in rows]

    def count(self) -> int:
        return self.conn.execute("SELECT COUNT(*) FROM documents WHERE user_id = ?", (self.user_id,)).fetchone()[0]

    def get(self, document_id: int) -> Document | None:
        row = self.conn.execute(
            f"SELECT {_COLUMNS} FROM documents WHERE id = ? AND user_id = ?", (document_id, self.user_id)
        ).fetchone()
        return row and self._to_document(row)

    def create(self, document_type: str, values: DocumentValues, messages: list[ChatMessage]) -> Document:
        with self.conn:
            cursor = self.conn.execute(
                "INSERT INTO documents (user_id, document_type, title, values_json, messages_json)"
                " VALUES (?, ?, ?, ?, ?)",
                (self.user_id, document_type, *self._serialize(document_type, values, messages)),
            )
        return self.get(cursor.lastrowid)

    def save(self, document: Document, values: DocumentValues, messages: list[ChatMessage]) -> Document:
        """Saves over `document`, unless it changed since it was read (then raises ConflictError)."""
        with self.conn:
            cursor = self.conn.execute(
                "UPDATE documents SET title = ?, values_json = ?, messages_json = ?, version = version + 1,"
                " updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND version = ?",
                (
                    *self._serialize(document.documentType, values, messages),
                    document.id,
                    self.user_id,
                    document.version,
                ),
            )
        if cursor.rowcount == 0:
            raise ConflictError(document.id)
        return self.get(document.id)

    def delete(self, document_id: int) -> bool:
        with self.conn:
            cursor = self.conn.execute(
                "DELETE FROM documents WHERE id = ? AND user_id = ?", (document_id, self.user_id)
            )
        return cursor.rowcount > 0

    def _serialize(
        self, document_type: str, values: DocumentValues, messages: list[ChatMessage]
    ) -> tuple[str, str, str]:
        title = document_title(self.registry[document_type], values)
        stored = [message.model_dump() for message in messages[-MAX_STORED_MESSAGES:]]
        return title, values.model_dump_json(), json.dumps(stored)

    def _to_summary(self, row: sqlite3.Row, values: DocumentValues) -> DocumentSummary:
        filled, total = progress(self.registry[row["document_type"]], values)
        return DocumentSummary(
            id=row["id"],
            documentType=row["document_type"],
            title=row["title"],
            filled=filled,
            total=total,
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
        )

    def _to_document(self, row: sqlite3.Row) -> Document:
        values = DocumentValues.model_validate_json(row["values_json"])
        return Document(
            **self._to_summary(row, values).model_dump(),
            values=values,
            messages=json.loads(row["messages_json"]),
            version=row["version"],
        )
