/**
 * DocIA — Database Operations Service
 *
 * Import / Export / Wipe logic.
 * All operations are local-only — no network calls.
 */
import { db } from "./schema";
import type { Document, Template, UserPreference, Project, ActivityLog } from "./schema";

/* ─── Types ─── */

export interface DatabaseExport {
  version: number;
  exportedAt: string;
  appVersion: string;
  data: {
    documents: Document[];
    templates: Template[];
    preferences: UserPreference[];
    projects: Project[];
    activityLogs: ActivityLog[];
  };
  checksum: string;
}

export interface DatabaseStats {
  totalDocuments: number;
  totalTemplates: number;
  totalProjects: number;
  totalActivities: number;
  storageEstimate: string;
  completedDocs: number;
  processingDocs: number;
  failedDocs: number;
}

/* ─── Helpers ─── */

function generateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36).padStart(8, "0");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ─── Export ─── */

export async function exportDatabase(): Promise<void> {
  const [documents, templates, preferences, projects, activityLogs] = await Promise.all([
    db.documents.toArray(),
    db.templates.toArray(),
    db.preferences.toArray(),
    db.projects.toArray(),
    db.activityLogs.toArray(),
  ]);

  const data = { documents, templates, preferences, projects, activityLogs };
  const checksum = generateChecksum(data);

  const exportPayload: DatabaseExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: "1.0.0",
    data,
    checksum,
  };

  const json = JSON.stringify(exportPayload, null, 2);
  const timestamp = new Date().toISOString().slice(0, 10);
  downloadFile(json, `docia-backup-${timestamp}.json`, "application/json");

  // Log the export activity
  await db.activityLogs.add({
    action: "export",
    entityType: "system",
    entityName: "Full Database",
    details: `Exported ${documents.length} documents, ${templates.length} templates, ${projects.length} projects`,
    timestamp: Date.now(),
  });
}

/* ─── Import ─── */

export async function importDatabase(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text();
    const parsed: DatabaseExport = JSON.parse(text);

    // Validate structure
    if (!parsed.version || !parsed.data || !parsed.checksum) {
      return { success: false, message: "Invalid backup file format." };
    }

    // Verify checksum
    const computedChecksum = generateChecksum(parsed.data);
    if (computedChecksum !== parsed.checksum) {
      return { success: false, message: "Checksum mismatch — file may be corrupted." };
    }

    // Clear existing data and import
    await db.transaction("rw", [db.documents, db.templates, db.preferences, db.projects, db.activityLogs], async () => {
      await db.documents.clear();
      await db.templates.clear();
      await db.preferences.clear();
      await db.projects.clear();
      await db.activityLogs.clear();

      if (parsed.data.documents?.length) await db.documents.bulkAdd(parsed.data.documents);
      if (parsed.data.templates?.length) await db.templates.bulkAdd(parsed.data.templates);
      if (parsed.data.preferences?.length) await db.preferences.bulkAdd(parsed.data.preferences);
      if (parsed.data.projects?.length) await db.projects.bulkAdd(parsed.data.projects);
      if (parsed.data.activityLogs?.length) await db.activityLogs.bulkAdd(parsed.data.activityLogs);
    });

    // Log the import
    await db.activityLogs.add({
      action: "import",
      entityType: "system",
      entityName: "Full Database",
      details: `Restored from backup dated ${parsed.exportedAt}`,
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: `Successfully restored: ${parsed.data.documents?.length ?? 0} documents, ${parsed.data.templates?.length ?? 0} templates, ${parsed.data.projects?.length ?? 0} projects.`,
    };
  } catch {
    return { success: false, message: "Failed to parse backup file. Ensure it's a valid DocIA export." };
  }
}

/* ─── Wipe All Data ─── */

export async function wipeAllData(): Promise<void> {
  await db.transaction("rw", [db.documents, db.templates, db.preferences, db.projects, db.activityLogs], async () => {
    await db.documents.clear();
    await db.templates.clear();
    await db.preferences.clear();
    await db.projects.clear();
    await db.activityLogs.clear();
  });
}

/* ─── Get Stats ─── */

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const [documents, templates, projects, activities] = await Promise.all([
    db.documents.toArray(),
    db.templates.count(),
    db.projects.count(),
    db.activityLogs.count(),
  ]);

  const totalSize = documents.reduce((acc, doc) => acc + (doc.size || 0), 0);

  return {
    totalDocuments: documents.length,
    totalTemplates: templates,
    totalProjects: projects,
    totalActivities: activities,
    storageEstimate: formatBytes(totalSize),
    completedDocs: documents.filter((d) => d.status === "completed").length,
    processingDocs: documents.filter((d) => d.status === "processing").length,
    failedDocs: documents.filter((d) => d.status === "failed").length,
  };
}

/* ─── Recent Activity ─── */

export async function getRecentActivity(limit = 10): Promise<ActivityLog[]> {
  return db.activityLogs.orderBy("timestamp").reverse().limit(limit).toArray();
}

/* ─── Recent Documents ─── */

export async function getRecentDocuments(limit = 5): Promise<Document[]> {
  return db.documents.orderBy("createdAt").reverse().limit(limit).toArray();
}
