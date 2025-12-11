import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, RefreshCw, Folder, AlertTriangle, ChevronRight, HardDrive, X, Check } from 'lucide-react';
import { settingsApi, mediaApi } from '../api/client';
import type { ScanPath } from '../types';

interface FolderItem {
    name: string;
    path: string;
    type: 'drive' | 'folder';
}

interface BrowseResult {
    path: string;
    parent: string | null;
    items: FolderItem[];
}

export default function SettingsPage() {
    const [scanPaths, setScanPaths] = useState<ScanPath[]>([]);
    const [settings, setSettings] = useState<Record<string, unknown>>({});
    const [newPath, setNewPath] = useState('');
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Folder browser state
    const [showBrowser, setShowBrowser] = useState(false);
    const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [selectedPath, setSelectedPath] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [pathsRes, settingsRes] = await Promise.all([
                settingsApi.getScanPaths(),
                settingsApi.getAll(),
            ]);
            setScanPaths(pathsRes.data.data);
            setSettings(settingsRes.data);
        } catch (err) {
            showMessage('error', 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleAddPath = async (pathToAdd?: string) => {
        const finalPath = pathToAdd || newPath.trim();
        if (!finalPath) return;

        setSaving(true);
        try {
            await settingsApi.addScanPath(finalPath);
            setNewPath('');
            setShowBrowser(false);
            setSelectedPath('');
            await loadData();
            showMessage('success', 'Path added successfully');
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to add path');
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePath = async (id: number) => {
        try {
            await settingsApi.deleteScanPath(id);
            await loadData();
            showMessage('success', 'Path removed');
        } catch (err) {
            showMessage('error', 'Failed to remove path');
        }
    };

    const handleScan = async () => {
        setScanning(true);
        try {
            const result = await mediaApi.scan();
            await loadData();
            const total = result.data.results?.reduce((acc: number, r: any) => acc + r.newFiles, 0) || 0;
            showMessage('success', `Scan complete. ${total} new files found.`);
        } catch (err) {
            showMessage('error', 'Scan failed');
        } finally {
            setScanning(false);
        }
    };

    const handleUpdateSetting = async (key: string, value: unknown) => {
        setSaving(true);
        try {
            await settingsApi.update({ [key]: value });
            setSettings({ ...settings, [key]: value });
            showMessage('success', 'Setting updated');
        } catch (err) {
            showMessage('error', 'Failed to update setting');
        } finally {
            setSaving(false);
        }
    };

    const handleClearHistory = async () => {
        if (!confirm('Clear all watch history? This cannot be undone.')) return;

        try {
            await settingsApi.clearHistory();
            showMessage('success', 'Watch history cleared');
        } catch (err) {
            showMessage('error', 'Failed to clear history');
        }
    };

    const handleClearTmdbCache = async () => {
        if (!confirm('Clear TMDB cache? Metadata will need to be re-fetched.')) return;

        try {
            await settingsApi.clearTmdbCache();
            showMessage('success', 'TMDB cache cleared. Run a scan to re-fetch metadata.');
        } catch (err) {
            showMessage('error', 'Failed to clear cache');
        }
    };

    // Folder browser functions
    const openFolderBrowser = async () => {
        setShowBrowser(true);
        setBrowseLoading(true);
        try {
            const res = await settingsApi.browseFolders();
            setBrowseData(res.data);
            setSelectedPath(res.data.path || '');
        } catch (err) {
            showMessage('error', 'Failed to browse folders');
            setShowBrowser(false);
        } finally {
            setBrowseLoading(false);
        }
    };

    const navigateToFolder = async (folderPath: string) => {
        setBrowseLoading(true);
        try {
            const res = await settingsApi.browseFolders(folderPath);
            setBrowseData(res.data);
            setSelectedPath(res.data.path || '');
        } catch (err) {
            showMessage('error', 'Failed to browse folder');
        } finally {
            setBrowseLoading(false);
        }
    };

    const navigateUp = async () => {
        if (browseData?.parent) {
            await navigateToFolder(browseData.parent);
        } else {
            // Go back to drives view
            setBrowseLoading(true);
            try {
                const res = await settingsApi.browseFolders();
                setBrowseData(res.data);
                setSelectedPath('');
            } catch (err) {
                showMessage('error', 'Failed to browse folders');
            } finally {
                setBrowseLoading(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="loading-spinner" />
            </div>
        );
    }

    return (
        <div className="min-h-screen px-8 py-6 max-w-4xl mx-auto animate-fadeIn">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Link to="/" className="text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-bold text-white">Nebula Player Settings</h1>
            </div>

            {/* Message Toast */}
            {message && (
                <div
                    className={`fixed top-4 right-4 px-5 py-4 rounded-xl shadow-2xl z-50 animate-fadeInUp flex items-center gap-3 ${message.type === 'success'
                        ? 'bg-linear-to-r from-green-600 to-green-700 border border-green-500'
                        : 'bg-linear-to-r from-red-600 to-red-700 border border-red-500'
                        } text-white min-w-[280px]`}
                >
                    {message.type === 'success' ? (
                        <Check className="w-5 h-5 shrink-0" />
                    ) : (
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                    )}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}

            {/* Folder Browser Modal */}
            {showBrowser && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 modal-backdrop">
                    <div className="bg-(--bg-secondary) rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-fadeInScale">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                            <h3 className="text-xl font-semibold text-white">Select Folder</h3>
                            <button
                                onClick={() => setShowBrowser(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Current Path */}
                        <div className="px-4 py-3 bg-(--bg-card) border-b border-gray-700">
                            <div className="flex items-center gap-2">
                                {browseData?.parent !== null && browseData?.path && (
                                    <button
                                        onClick={navigateUp}
                                        className="text-sm text-gray-400 hover:text-white transition-colors"
                                    >
                                        ← Back
                                    </button>
                                )}
                                {!browseData?.path && (
                                    <span className="text-gray-400 text-sm">Select a drive</span>
                                )}
                                {browseData?.path && (
                                    <span className="text-teal-400 font-mono text-sm truncate">
                                        {browseData.path}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Folder List */}
                        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
                            {browseLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="loading-spinner" />
                                </div>
                            ) : browseData?.items.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    No subfolders found
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {browseData?.items.map((item) => (
                                        <button
                                            key={item.path}
                                            onClick={() => navigateToFolder(item.path)}
                                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-(--bg-card) transition-colors text-left group"
                                        >
                                            {item.type === 'drive' ? (
                                                <HardDrive className="w-5 h-5 text-teal-400" />
                                            ) : (
                                                <Folder className="w-5 h-5 text-yellow-400" />
                                            )}
                                            <span className="text-white flex-1 truncate">{item.name}</span>
                                            <ChevronRight className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-700 flex items-center justify-between gap-4">
                            <div className="flex-1 text-sm text-gray-400 truncate">
                                {selectedPath ? `Selected: ${selectedPath}` : 'Navigate to a folder'}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowBrowser(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAddPath(selectedPath)}
                                    disabled={!selectedPath || saving}
                                    className="btn-primary"
                                >
                                    <Check className="w-4 h-4" />
                                    {saving ? 'Adding...' : 'Select This Folder'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Library Paths */}
            <section className="mb-10">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Folder className="w-5 h-5" />
                    Library Paths
                </h2>

                <div className="bg-(--bg-secondary) rounded-lg p-4">
                    {/* Existing Paths */}
                    {scanPaths.length === 0 ? (
                        <p className="text-gray-400 mb-4">No library paths configured. Add a folder to scan for media.</p>
                    ) : (
                        <ul className="space-y-3 mb-4">
                            {scanPaths.map((path) => (
                                <li
                                    key={path.id}
                                    className={`flex items-center justify-between p-3 rounded-lg transition-all ${path.exists ? 'bg-(--bg-card)' : 'bg-red-900/20 border border-red-800'
                                        }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white truncate">{path.path}</p>
                                        <p className="text-sm text-gray-500">
                                            {path.files_found} files
                                            {path.last_scan_at && ` • Last scan: ${new Date(path.last_scan_at).toLocaleDateString()}`}
                                        </p>
                                        {!path.exists && (
                                            <p className="text-sm text-red-400 flex items-center gap-1">
                                                <AlertTriangle className="w-4 h-4" />
                                                Path not found
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeletePath(path.id)}
                                        className="ml-4 p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                        title="Remove path"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Add New Path */}
                    <div className="flex gap-2">
                        <button
                            onClick={openFolderBrowser}
                            className="btn-primary flex-1"
                        >
                            <Folder className="w-5 h-5" />
                            Browse for Folder
                        </button>
                    </div>

                    {/* Manual Path Entry (collapsed) */}
                    <details className="mt-3">
                        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
                            Or enter path manually
                        </summary>
                        <div className="flex gap-2 mt-2">
                            <input
                                type="text"
                                value={newPath}
                                onChange={(e) => setNewPath(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddPath()}
                                placeholder="Enter folder path (e.g., D:\Movies)"
                                className="flex-1 px-4 py-2 bg-(--bg-card) border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-teal-500 transition-colors"
                            />
                            <button
                                onClick={() => handleAddPath()}
                                disabled={saving || !newPath.trim()}
                                className="btn-secondary"
                            >
                                <Plus className="w-5 h-5" />
                                Add
                            </button>
                        </div>
                    </details>

                    {/* Scan Button */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <button
                            onClick={handleScan}
                            disabled={scanning || scanPaths.length === 0}
                            className="btn-secondary w-full justify-center"
                        >
                            <RefreshCw className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
                            {scanning ? 'Scanning Library...' : 'Scan Library Now'}
                        </button>
                    </div>
                </div>
            </section>

            {/* Playback Settings */}
            <section className="mb-10">
                <h2 className="text-xl font-semibold text-white mb-4">Playback</h2>

                <div className="bg-(--bg-secondary) rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white">Autoplay Next Episode</p>
                            <p className="text-sm text-gray-500">Automatically play the next episode in TV shows</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.autoplay_next_episode === true}
                                onChange={(e) => handleUpdateSetting('autoplay_next_episode', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white">Default Subtitle Language</p>
                            <p className="text-sm text-gray-500">Preferred subtitle track</p>
                        </div>
                        <select
                            value={String(settings.default_subtitle_language || 'eng')}
                            onChange={(e) => handleUpdateSetting('default_subtitle_language', e.target.value)}
                            className="px-3 py-2 bg-(--bg-card) border border-gray-700 rounded-lg text-white focus:border-teal-500 focus:outline-none transition-colors"
                        >
                            <option value="eng">English</option>
                            <option value="spa">Spanish</option>
                            <option value="fre">French</option>
                            <option value="ger">German</option>
                            <option value="jpn">Japanese</option>
                            <option value="kor">Korean</option>
                        </select>
                    </div>
                </div>
            </section>

            {/* Data Management */}
            <section className="mb-10">
                <h2 className="text-xl font-semibold text-white mb-4">Data Management</h2>

                <div className="bg-(--bg-secondary) rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white">Clear Watch History</p>
                            <p className="text-sm text-gray-500">Remove all playback progress and watch counts</p>
                        </div>
                        <button onClick={handleClearHistory} className="btn-secondary text-red-400 hover:bg-red-400/10">
                            Clear
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white">Re-fetch TMDB Metadata</p>
                            <p className="text-sm text-gray-500">Clear cached data and fetch fresh metadata</p>
                        </div>
                        <button onClick={handleClearTmdbCache} className="btn-secondary text-yellow-400 hover:bg-yellow-400/10">
                            Clear Cache
                        </button>
                    </div>
                </div>
            </section>

            {/* About */}
            <section>
                <h2 className="text-xl font-semibold text-white mb-4">About</h2>
                <div className="bg-(--bg-secondary) rounded-lg p-4">
                    <p className="text-gray-400">
                        Nebula Player - Stream your local video library with style
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        Version 1.0.0 • Built with React, Express, and FFmpeg
                    </p>
                </div>
            </section>
        </div>
    );
}
