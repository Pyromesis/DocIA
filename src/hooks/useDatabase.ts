/**
 * DocIA — React hook for database operations.
 * Provides reactive state + operations for the UI layer.
 */
import { useState, useEffect, useCallback } from "react";
import { seedDatabase } from "@/db/seed";
import {
  getDatabaseStats,
  getRecentDocuments,
  getRecentActivity,
  exportDatabase,
  importDatabase,
  wipeAllData,
  type DatabaseStats,
} from "@/db/operations";
import type { Document, ActivityLog } from "@/db/schema";

interface UseDatabaseReturn {
  stats: DatabaseStats | null;
  recentDocs: Document[];
  recentActivity: ActivityLog[];
  isLoading: boolean;
  isExporting: boolean;
  isImporting: boolean;
  isWiping: boolean;
  error: string | null;
  successMessage: string | null;
  refresh: () => Promise<void>;
  handleExport: () => Promise<void>;
  handleImport: (file: File) => Promise<void>;
  handleWipe: () => Promise<void>;
  clearMessages: () => void;
}

export function useDatabase(): UseDatabaseReturn {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, docs, activity] = await Promise.all([
        getDatabaseStats(),
        getRecentDocuments(8),
        getRecentActivity(10),
      ]);
      setStats(s);
      setRecentDocs(docs);
      setRecentActivity(activity);
    } catch {
      setError("Failed to load database stats.");
    }
  }, []);

  // Initialize: seed + load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await seedDatabase();
      await refresh();
      setIsLoading(false);
    };
    init();
  }, [refresh]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);
    try {
      await exportDatabase();
      setSuccessMessage("Database exported successfully.");
      await refresh();
    } catch {
      setError("Export failed. Please try again.");
    }
    setIsExporting(false);
  }, [refresh]);

  const handleImport = useCallback(async (file: File) => {
    setIsImporting(true);
    setError(null);
    try {
      const result = await importDatabase(file);
      if (result.success) {
        setSuccessMessage(result.message);
        await refresh();
      } else {
        setError(result.message);
      }
    } catch {
      setError("Import failed. Ensure the file is valid.");
    }
    setIsImporting(false);
  }, [refresh]);

  const handleWipe = useCallback(async () => {
    setIsWiping(true);
    setError(null);
    try {
      await wipeAllData();
      setSuccessMessage("All data wiped securely from this browser.");
      await refresh();
    } catch {
      setError("Wipe failed. Please try again.");
    }
    setIsWiping(false);
  }, [refresh]);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
    stats,
    recentDocs,
    recentActivity,
    isLoading,
    isExporting,
    isImporting,
    isWiping,
    error,
    successMessage,
    refresh,
    handleExport,
    handleImport,
    handleWipe,
    clearMessages,
  };
}
