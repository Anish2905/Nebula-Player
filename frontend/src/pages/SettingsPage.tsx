import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, RefreshCw, Folder, AlertTriangle } from 'lucide-react';
import { settingsApi, mediaApi } from '../api/client';
import type { ScanPath } from '../types';

export default function SettingsPage() {
    const [scanPaths, setScanPaths] = useState<ScanPath[]>([]);
    const [settings, setSettings] = useState<Record<string, unknown>>({});
    const [newPath, setNewPath] = useState('');
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

    const handleAddPath = async () => {
        if (!newPath.trim()) return;

        setSaving(true);
        try {
            await settingsApi.addScanPath(newPath.trim());
            setNewPath('');
            await loadData();
            showMessage('success', 'Path added successfully');
        } catch (err: any) {
            showMessage('error', err.response?.data?.error || 'Failed to add path');
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePath = async (id: number) => {
        if (!confirm('Remove this library path?')) return;

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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-t-[var(--accent)] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen px-8 py-6 max-w-4xl mx-auto">
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
                    className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50 ${message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                        } text-white`}
                >
                    {message.text}
                </div>
            )}

            {/* Library Paths */}
            <section className="mb-10">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Folder className="w-5 h-5" />
                    Library Paths
                </h2>

                <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                    {/* Existing Paths */}
                    {scanPaths.length === 0 ? (
                        <p className="text-gray-400 mb-4">No library paths configured. Add a folder to scan for media.</p>
                    ) : (
                        <ul className="space-y-3 mb-4">
                            {scanPaths.map((path) => (
                                <li
                                    key={path.id}
                                    className={`flex items-center justify-between p-3 rounded ${path.exists ? 'bg-[var(--bg-card)]' : 'bg-red-900/20 border border-red-800'
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
                                        className="ml-4 text-gray-400 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Add New Path */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newPath}
                            onChange={(e) => setNewPath(e.target.value)}
                            placeholder="Enter folder path (e.g., D:\Movies)"
                            className="flex-1 px-4 py-2 bg-[var(--bg-card)] border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                        />
                        <button
                            onClick={handleAddPath}
                            disabled={saving || !newPath.trim()}
                            className="btn-primary"
                        >
                            <Plus className="w-5 h-5" />
                            Add
                        </button>
                    </div>

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

                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 space-y-4">
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
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
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
                            className="px-3 py-2 bg-[var(--bg-card)] border border-gray-700 rounded text-white"
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

                <div className="bg-[var(--bg-secondary)] rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white">Clear Watch History</p>
                            <p className="text-sm text-gray-500">Remove all playback progress and watch counts</p>
                        </div>
                        <button onClick={handleClearHistory} className="btn-secondary text-red-400">
                            Clear
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-white">Re-fetch TMDB Metadata</p>
                            <p className="text-sm text-gray-500">Clear cached data and fetch fresh metadata</p>
                        </div>
                        <button onClick={handleClearTmdbCache} className="btn-secondary text-yellow-400">
                            Clear Cache
                        </button>
                    </div>
                </div>
            </section>

            {/* About */}
            <section>
                <h2 className="text-xl font-semibold text-white mb-4">About</h2>
                <div className="bg-[var(--bg-secondary)] rounded-lg p-4">
                    <p className="text-gray-400">
                        Local Media Player - Netflix-style local video streaming
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                        Version 1.0.0 • Built with React, Express, and Video.js
                    </p>
                </div>
            </section>
        </div>
    );
}
