import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, RefreshCw, Check, ArrowRight, HardDrive, ChevronRight } from 'lucide-react';
import { settingsApi, mediaApi } from '../api/client';

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

export default function WelcomePage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Step 2 State
    const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [selectedPath, setSelectedPath] = useState('');
    const [addingPath, setAddingPath] = useState(false);

    // Step 3 State
    const [scanning, setScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);

    // Initial load for browsing
    const loadDrives = async () => {
        setBrowseLoading(true);
        try {
            const res = await settingsApi.browseFolders();
            setBrowseData(res.data);
            setSelectedPath('');
        } catch (err) {
            console.error(err);
        } finally {
            setBrowseLoading(false);
        }
    };

    const navigateToFolder = async (path: string) => {
        setBrowseLoading(true);
        try {
            const res = await settingsApi.browseFolders(path);
            setBrowseData(res.data);
            setSelectedPath(res.data.path || '');
        } catch (err) {
            console.error(err);
        } finally {
            setBrowseLoading(false);
        }
    };

    const navigateUp = () => {
        if (browseData?.parent) {
            navigateToFolder(browseData.parent);
        } else {
            loadDrives();
        }
    };

    const handleAddPath = async () => {
        if (!selectedPath) return;
        setAddingPath(true);
        try {
            await settingsApi.addScanPath(selectedPath);
            setStep(3);
            startScan(); // Auto-start scan
        } catch (err) {
            console.error(err);
            // Ideally show error toast
        } finally {
            setAddingPath(false);
        }
    };

    const startScan = async () => {
        setScanning(true);
        try {
            await mediaApi.scan();
            setScanComplete(true);
        } catch (err) {
            console.error(err);
        } finally {
            setScanning(false);
        }
    };

    const handleFinish = () => {
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">

            {/* Step 1: Welcome */}
            {step === 1 && (
                <div className="max-w-2xl w-full text-center space-y-8 animate-fadeInUp">
                    <div className="w-24 h-24 bg-linear-to-br from-teal-500 to-blue-600 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-teal-900/50">
                        <span className="text-4xl">🌌</span>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-5xl font-bold bg-linear-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
                            Welcome to Nebula
                        </h1>
                        <p className="text-xl text-gray-400">
                            Your personal streaming sanctuary. Let's get your library set up.
                        </p>
                    </div>

                    <button
                        onClick={() => { setStep(2); loadDrives(); }}
                        className="px-8 py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform flex items-center gap-2 mx-auto"
                    >
                        Get Started <ArrowRight className="w-5 h-5" />
                    </button>

                    <p className="text-sm text-gray-600">v1.0.0 • Local Video Player</p>
                </div>
            )}

            {/* Step 2: Browse & Select Folder */}
            {step === 2 && (
                <div className="max-w-3xl w-full animate-fadeInUp bg-(--bg-secondary) rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-white/10">
                        <h2 className="text-2xl font-bold mb-2">Where are your videos?</h2>
                        <p className="text-gray-400">Select the main folder containing your movies or TV shows.</p>
                    </div>

                    <div className="h-[400px] flex flex-col">
                        {/* Browser Header */}
                        <div className="px-6 py-3 bg-black/20 border-b border-white/5 flex items-center gap-3">
                            {browseData?.path ? (
                                <>
                                    <button onClick={navigateUp} className="text-sm text-teal-400 hover:underline">
                                        ← Back
                                    </button>
                                    <span className="text-gray-500">/</span>
                                    <span className="text-gray-300 font-mono text-sm truncate flex-1 block">
                                        {browseData.path}
                                    </span>
                                </>
                            ) : (
                                <span className="text-gray-400 text-sm">Select Drive</span>
                            )}
                        </div>

                        {/* File List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-1">
                            {browseLoading ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="loading-spinner" />
                                </div>
                            ) : (
                                browseData?.items.map((item) => (
                                    <button
                                        key={item.path}
                                        onClick={() => navigateToFolder(item.path)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors text-left group
                                            ${selectedPath === item.path ? 'bg-teal-500/20 border border-teal-500/50' : ''}
                                        `}
                                    >
                                        {item.type === 'drive' ? (
                                            <HardDrive className="w-5 h-5 text-teal-400" />
                                        ) : (
                                            <Folder className="w-5 h-5 text-yellow-400" />
                                        )}
                                        <span className="flex-1 truncate font-medium">{item.name}</span>
                                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                            {selectedPath ? 'Folder selected' : 'Please select a folder'}
                        </div>
                        <button
                            onClick={handleAddPath}
                            disabled={!selectedPath || addingPath}
                            className="px-6 py-3 bg-teal-500 text-white font-bold rounded-lg hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                        >
                            {addingPath ? 'Adding...' : 'Select This Folder'}
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Initial Scan */}
            {step === 3 && (
                <div className="max-w-xl w-full text-center space-y-8 animate-fadeInUp">
                    <div className="relative w-32 h-32 mx-auto">
                        <div className={`absolute inset-0 border-4 border-teal-500/30 rounded-full ${scanning ? 'animate-ping' : ''}`} />
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-full border-4 border-teal-500 z-10">
                            {scanComplete ? (
                                <Check className="w-16 h-16 text-teal-500" />
                            ) : (
                                <RefreshCw className="w-12 h-12 text-teal-500 animate-spin" />
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-3xl font-bold">
                            {scanComplete ? 'Library Ready!' : 'Building Your Library...'}
                        </h2>
                        <p className="text-gray-400">
                            {scanComplete
                                ? "We've found your media and fetched all the artwork."
                                : "Scanning files, fetching posters, and organizing everything."}
                        </p>
                    </div>

                    {scanComplete && (
                        <button
                            onClick={handleFinish}
                            className="px-10 py-4 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform animate-fadeIn"
                        >
                            Start Watching
                        </button>
                    )}
                </div>
            )}

        </div>
    );
}
