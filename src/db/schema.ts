/**
 * DocIA — IndexedDB Schema & Database Instance
 *
 * All user data stays in-browser. Zero server storage.
 * Uses Dexie.js for a clean, typed IndexedDB API.
 */
import Dexie, { type EntityTable } from "dexie";

/* ─── Entity Interfaces ─── */

export interface DocumentField {
  label: string;
  value: string;
  confidence?: number;
}

export interface DocumentMetadata {
  fields?: DocumentField[];
  summary?: string;
  rawText?: string;
  [key: string]: unknown;
}

export interface Document {
  id?: number;
  name: string;
  type: string; // pdf, docx, jpg, png, etc.
  size: number; // bytes
  status: "pending" | "processing" | "completed" | "failed";
  content?: string; // extracted text / base64
  metadata?: DocumentMetadata;
  projectId?: number;
  templateId?: number;
  createdAt: number; // timestamp
  updatedAt: number;
}

export interface Template {
  id?: number;
  name: string;
  description: string;
  schema: Record<string, unknown>; // field definitions
  outputFormat: "pdf" | "docx" | "json" | "csv";
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserPreference {
  id?: number;
  key: string;
  value: string | number | boolean | Record<string, unknown>;
}

export interface Project {
  id?: number;
  name: string;
  description: string;
  documentIds?: number[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectFolder {
  id?: number;
  projectId: number;
  name: string;
  parentFolderId?: number; // for nested folders
  createdAt: number;
}

export interface ActivityLog {
  id?: number;
  action: string; // 'upload' | 'process' | 'export' | 'delete' | 'template_create' etc.
  entityType: "document" | "template" | "project" | "system";
  entityName: string;
  details?: string;
  timestamp: number;
}

export interface AIMemoryEntry {
  id?: number;
  type: 'document_pattern' | 'field_schema' | 'training_insight' | 'user_preference';
  category: string;         // e.g. "invoice", "contract", "personal_info"
  title: string;            // human-readable label
  content: string;          // JSON-encoded data (patterns, schema, insights)
  tags: string[];           // searchable keywords
  sourceDocumentName?: string;
  occurrences: number;      // how many times this pattern was seen
  confidence: number;       // 0-1 reliability score, increases with consolidation
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
}

/* ─── Database Class ─── */

class DocIADatabase extends Dexie {
  documents!: EntityTable<Document, "id">;
  templates!: EntityTable<Template, "id">;
  preferences!: EntityTable<UserPreference, "id">;
  projects!: EntityTable<Project, "id">;
  projectFolders!: EntityTable<ProjectFolder, "id">;
  activityLogs!: EntityTable<ActivityLog, "id">;
  aiMemory!: EntityTable<AIMemoryEntry, "id">;

  constructor() {
    super("DocIA_LocalDB");

    this.version(1).stores({
      documents: "++id, name, type, status, projectId, templateId, createdAt, updatedAt",
      templates: "++id, name, outputFormat, isDefault, createdAt",
      preferences: "++id, &key",
      projects: "++id, name, createdAt",
      activityLogs: "++id, action, entityType, timestamp",
    });

    this.version(2).stores({
      documents: "++id, name, type, status, projectId, templateId, createdAt, updatedAt",
      templates: "++id, name, outputFormat, isDefault, createdAt",
      preferences: "++id, &key",
      projects: "++id, name, createdAt",
      activityLogs: "++id, action, entityType, timestamp",
      aiMemory: "++id, type, category, lastAccessedAt, createdAt, *tags",
    });

    this.version(3).stores({
      documents: "++id, name, type, status, projectId, templateId, folderId, createdAt, updatedAt",
      templates: "++id, name, outputFormat, isDefault, createdAt",
      preferences: "++id, &key",
      projects: "++id, name, createdAt",
      projectFolders: "++id, projectId, parentFolderId, createdAt",
      activityLogs: "++id, action, entityType, timestamp",
      aiMemory: "++id, type, category, lastAccessedAt, createdAt, *tags",
    });
  }
}

/* ─── Singleton Export ─── */
export const db = new DocIADatabase();
