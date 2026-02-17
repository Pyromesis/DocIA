/**
 * ProjectsPage — Organize documents into projects/folders.
 * Features: folder creation, add existing documents, ZIP download.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    FolderOpen, Plus, Trash2, FileText, Check, X,
    FolderPlus, ChevronRight, ChevronDown,
    FilePlus2, Archive
} from 'lucide-react';
import { db, type Project } from '../../db/schema';
import { useLanguage } from '../../context/LanguageContext';
import { DocumentEditor } from '../DocumentEditor';

const stripHtml = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
};

export function ProjectsPage() {
    const [showNewProject, setShowNewProject] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [expandedProject, setExpandedProject] = useState<number | null>(null);
    const [showAddFolder, setShowAddFolder] = useState<number | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [showAddDoc, setShowAddDoc] = useState<number | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
    const { t } = useLanguage();

    const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray());
    const allFolders = useLiveQuery(() => db.projectFolders.toArray()) || [];
    const allDocuments = useLiveQuery(() => db.documents.toArray()) || [];
    const isLoading = projects === undefined;

    const handleCreateProject = async () => {
        if (!newName.trim()) return;
        const now = Date.now();
        await db.projects.add({
            name: newName.trim(),
            description: newDescription.trim(),
            documentIds: [],
            createdAt: now,
            updatedAt: now,
        });
        await db.activityLogs.add({
            action: 'template_create',
            entityType: 'project',
            entityName: newName.trim(),
            details: 'Created new project',
            timestamp: now,
        });
        setNewName('');
        setNewDescription('');
        setShowNewProject(false);
    };

    const handleDeleteProject = async (id: number) => {
        if (confirm(t('projects.confirmDelete'))) {
            // Also delete associated folders
            await db.projectFolders.where('projectId').equals(id).delete();
            await db.projects.delete(id);
        }
    };

    const handleCreateFolder = async (projectId: number, parentFolderId?: number) => {
        if (!newFolderName.trim()) return;
        await db.projectFolders.add({
            projectId,
            name: newFolderName.trim(),
            parentFolderId,
            createdAt: Date.now(),
        });
        setNewFolderName('');
        setShowAddFolder(null);
    };

    const handleDeleteFolder = async (folderId: number) => {
        // Delete sub-folders recursively
        const children = allFolders.filter(f => f.parentFolderId === folderId);
        for (const child of children) {
            if (child.id) await handleDeleteFolder(child.id);
        }
        await db.projectFolders.delete(folderId);
    };

    const handleAddDocToProject = async (projectId: number, docId: number) => {
        const project = await db.projects.get(projectId);
        if (!project) return;
        const ids = new Set(project.documentIds || []);
        ids.add(docId);
        await db.projects.update(projectId, {
            documentIds: Array.from(ids),
            updatedAt: Date.now(),
        });
    };

    const handleRemoveDocFromProject = async (projectId: number, docId: number) => {
        const project = await db.projects.get(projectId);
        if (!project) return;
        const ids = (project.documentIds || []).filter(id => id !== docId);
        await db.projects.update(projectId, {
            documentIds: ids,
            updatedAt: Date.now(),
        });
    };

    const handleDownloadZip = useCallback(async (project: Project) => {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        const docIds = project.documentIds || [];
        const docs = allDocuments.filter(d => d.id && docIds.includes(d.id));

        for (const doc of docs) {
            const content = doc.content || doc.metadata?.rawText || `Document: ${doc.name}\nStatus: ${doc.status}`;
            zip.file(`${doc.name}.txt`, content);
        }

        // Add project info
        zip.file("_project_info.txt", `Project: ${project.name}\nDescription: ${stripHtml(project.description)}\nDocuments: ${docs.length}\nExported: ${new Date().toISOString()}`);

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    }, [allDocuments]);

    const toggleFolder = (folderId: number) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
    };

    // Available docs = docs not already in this project
    const getAvailableDocs = (project: Project) => {
        const existing = new Set(project.documentIds || []);
        return allDocuments.filter(d => d.id && !existing.has(d.id));
    };

    // Get folders for a project (top-level)
    const getProjectFolders = (projectId: number, parentId?: number) => {
        return allFolders.filter(f =>
            f.projectId === projectId && f.parentFolderId === parentId
        );
    };

    // Render folder tree recursively
    const renderFolderTree = (projectId: number, parentId?: number, depth = 0) => {
        const folders = getProjectFolders(projectId, parentId);
        if (folders.length === 0 && depth > 0) return null;

        return folders.map(folder => (
            <div key={folder.id} style={{ paddingLeft: `${depth * 16}px` }}>
                <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 group text-sm">
                    <button onClick={() => toggleFolder(folder.id!)} className="p-0.5">
                        {expandedFolders.has(folder.id!) ? (
                            <ChevronDown size={14} className="text-gray-400" />
                        ) : (
                            <ChevronRight size={14} className="text-gray-400" />
                        )}
                    </button>
                    <FolderOpen size={14} className="text-[#B8925C]" />
                    <span className="text-gray-700 flex-1">{folder.name}</span>
                    <button
                        onClick={() => handleDeleteFolder(folder.id!)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 rounded text-gray-400 hover:text-rose-500 transition-all"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
                {expandedFolders.has(folder.id!) && renderFolderTree(projectId, folder.id, depth + 1)}
            </div>
        ));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="h-8 w-8 rounded-full border-2 border-stone-200 border-t-[#7C5C3F]"
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 font-display">{t('projects.title')}</h1>
                    <p className="text-gray-500 mt-1">{t('projects.subtitle')}</p>
                </div>
                <button
                    onClick={() => setShowNewProject(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#7C5C3F] text-white text-sm font-medium rounded-xl hover:bg-[#664D35] transition-colors shadow-sm"
                >
                    <Plus size={16} />
                    {t('projects.create')}
                </button>
            </div>

            {/* Create New Project Form */}
            <AnimatePresence>
                {showNewProject && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-800">{t('projects.create')}</h3>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={t('projects.namePlaceholder')}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#B8925C] focus:ring-2 focus:ring-[#B8925C]/20 transition-all"
                                autoFocus
                            />
                            <div className="h-40 border border-gray-200 rounded-lg overflow-hidden">
                                <DocumentEditor
                                    initialContent={newDescription}
                                    onChange={setNewDescription}
                                    placeholder={t('projects.descPlaceholder')}
                                    hideToolbar={true}
                                    editorClassName="text-sm p-3"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCreateProject}
                                    disabled={!newName.trim()}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#7C5C3F] text-white text-sm rounded-lg hover:bg-[#664D35] transition-colors disabled:opacity-50"
                                >
                                    <Check size={14} /> {t('projects.createBtn')}
                                </button>
                                <button
                                    onClick={() => setShowNewProject(false)}
                                    className="flex items-center gap-1.5 px-4 py-2 text-gray-500 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    <X size={14} /> {t('projects.cancelBtn')}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Projects Grid */}
            {!projects || projects.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-[50vh] text-center"
                >
                    <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                        <FolderOpen className="w-7 h-7 text-stone-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">{t('projects.noProjects')}</h3>
                    <p className="text-sm text-gray-400 max-w-sm">
                        {t('projects.noProjectsDesc')}
                    </p>
                </motion.div>
            ) : (
                <div className="space-y-4">
                    {projects.map((project, i) => {
                        const docCount = project.documentIds?.length || 0;
                        const isExpanded = expandedProject === project.id;
                        const projectDocs = allDocuments.filter(d => d.id && (project.documentIds || []).includes(d.id));
                        const projectFolders = getProjectFolders(project.id!);

                        return (
                            <motion.div
                                key={project.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                            >
                                {/* Project Header */}
                                <div
                                    className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                                    onClick={() => setExpandedProject(isExpanded ? null : project.id!)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-tan-50 rounded-lg text-[#7C5C3F] border border-tan-200/50">
                                                <FolderOpen size={20} />
                                            </div>
                                            <div>
                                                <h3 className="text-[15px] font-semibold text-gray-800">{project.name}</h3>
                                                {project.description && (
                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{stripHtml(project.description)}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <FileText size={12} /> {docCount} docs
                                            </span>
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                                <FolderOpen size={12} /> {projectFolders.length} folders
                                            </span>
                                            <ChevronDown
                                                size={16}
                                                className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden border-t border-gray-100"
                                        >
                                            <div className="p-5 space-y-4">
                                                {/* Action bar */}
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShowAddFolder(project.id!); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#7C5C3F] bg-tan-50 border border-tan-200/50 rounded-lg hover:bg-tan-100 transition-colors"
                                                    >
                                                        <FolderPlus size={14} /> New Folder
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShowAddDoc(project.id!); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
                                                    >
                                                        <FilePlus2 size={14} /> Add Document
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownloadZip(project); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors"
                                                    >
                                                        <Archive size={14} /> Download ZIP
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id!); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-500 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 transition-colors ml-auto"
                                                    >
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                </div>

                                                {/* New Folder form */}
                                                <AnimatePresence>
                                                    {showAddFolder === project.id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                                                <FolderPlus size={16} className="text-[#B8925C]" />
                                                                <input
                                                                    type="text"
                                                                    value={newFolderName}
                                                                    onChange={e => setNewFolderName(e.target.value)}
                                                                    placeholder="Folder name..."
                                                                    className="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#B8925C]"
                                                                    autoFocus
                                                                    onKeyDown={e => e.key === 'Enter' && handleCreateFolder(project.id!)}
                                                                />
                                                                <button
                                                                    onClick={() => handleCreateFolder(project.id!)}
                                                                    disabled={!newFolderName.trim()}
                                                                    className="px-3 py-1.5 bg-[#7C5C3F] text-white text-xs rounded-lg hover:bg-[#664D35] disabled:opacity-50"
                                                                >
                                                                    Create
                                                                </button>
                                                                <button
                                                                    onClick={() => { setShowAddFolder(null); setNewFolderName(''); }}
                                                                    className="p-1.5 text-gray-400 hover:text-gray-600"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {/* Add Document picker */}
                                                <AnimatePresence>
                                                    {showAddDoc === project.id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-medium text-blue-700">Select documents to add:</span>
                                                                    <button onClick={() => setShowAddDoc(null)} className="p-1 text-gray-400 hover:text-gray-600">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                                <div className="max-h-48 overflow-y-auto space-y-1">
                                                                    {getAvailableDocs(project).length === 0 ? (
                                                                        <p className="text-xs text-gray-400 py-2 text-center">No available documents to add.</p>
                                                                    ) : (
                                                                        getAvailableDocs(project).map(doc => (
                                                                            <button
                                                                                key={doc.id}
                                                                                onClick={() => handleAddDocToProject(project.id!, doc.id!)}
                                                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg hover:bg-blue-100 transition-colors"
                                                                            >
                                                                                <FileText size={14} className="text-gray-400" />
                                                                                <span className="flex-1 text-gray-700">{doc.name}</span>
                                                                                <Plus size={14} className="text-blue-500" />
                                                                            </button>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                {/* Folder tree */}
                                                {projectFolders.length > 0 && (
                                                    <div className="space-y-0.5">
                                                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Folders</span>
                                                        {renderFolderTree(project.id!)}
                                                    </div>
                                                )}

                                                {/* Documents list */}
                                                {projectDocs.length > 0 ? (
                                                    <div className="space-y-1">
                                                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Documents</span>
                                                        {projectDocs.map(doc => (
                                                            <div key={doc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 group text-sm">
                                                                <FileText size={14} className="text-gray-400" />
                                                                <span className="flex-1 text-gray-700">{doc.name}</span>
                                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${doc.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {doc.status}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleRemoveDocFromProject(project.id!, doc.id!)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 rounded text-gray-400 hover:text-rose-500 transition-all"
                                                                    title="Remove from project"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400 text-center py-4">
                                                        No documents yet. Click "Add Document" to get started.
                                                    </p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
