import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, X, RefreshCw } from 'lucide-react';
import api from '../api/client';

interface ConversionJob {
    mediaId: number;
    fileName: string;
    status: 'queued' | 'converting' | 'completed' | 'failed';
    progress: number;
    error?: string;
}

interface ConversionStatus {
    active: ConversionJob[];
    queued: number[];
    completed: number;
    totalInQueue: number;
}

export default function ConversionProgress() {
    const [status, setStatus] = useState<ConversionStatus | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const [isConnected, setIsConnected] = useState(false);

    // Connect to SSE for real-time updates
    useEffect(() => {
        const eventSource = new EventSource('/api/conversion/events');

        eventSource.onopen = () => {
            setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'status') {
                    setStatus(data.data);
                } else if (data.type === 'progress') {
                    setStatus(prev => {
                        if (!prev) return prev;
                        const active = prev.active.map(job =>
                            job.mediaId === data.data.mediaId
                                ? { ...job, progress: data.data.progress }
                                : job
                        );
                        return { ...prev, active };
                    });
                } else if (data.type === 'completed' || data.type === 'started' || data.type === 'failed') {
                    // Refresh full status
                    fetchStatus();
                }
            } catch (e) {
                console.error('SSE parse error:', e);
            }
        };

        eventSource.onerror = () => {
            setIsConnected(false);
            // Browser will auto-reconnect
        };

        // Initial fetch
        fetchStatus();

        return () => {
            eventSource.close();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchStatus = useCallback(async () => {
        try {
            const response = await api.get('/conversion/status');
            setStatus(response.data);
        } catch (e) {
            console.error('Failed to fetch conversion status:', e);
        }
    }, []);

    const queueAll = async () => {
        try {
            await api.post('/conversion/queue-all');
            fetchStatus();
        } catch (e) {
            console.error('Failed to queue all:', e);
        }
    };

    // Don't show if nothing is happening
    if (!status || (status.active.length === 0 && status.queued.length === 0)) {
        return null;
    }

    const activeJobs = status.active.filter(j => j.status === 'converting');
    const completedJobs = status.active.filter(j => j.status === 'completed');
    const failedJobs = status.active.filter(j => j.status === 'failed');
    const queuedCount = status.queued.length;

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 bg-gray-800/50 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-white">Media Conversion</span>
                </div>
                <div className="flex items-center gap-2">
                    {activeJobs.length > 0 && (
                        <span className="text-xs text-teal-400 bg-teal-500/20 px-2 py-0.5 rounded-full">
                            {activeJobs.length} active
                        </span>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className="text-gray-400 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                    {/* Active jobs */}
                    {activeJobs.map(job => (
                        <div key={job.mediaId} className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 text-teal-400 animate-spin shrink-0" />
                                <span className="text-sm text-gray-300 truncate">{job.fileName}</span>
                            </div>
                            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-teal-500 transition-all duration-300"
                                    style={{ width: `${job.progress}%` }}
                                />
                            </div>
                            <span className="text-xs text-gray-500">{job.progress}% complete</span>
                        </div>
                    ))}

                    {/* Completed jobs */}
                    {completedJobs.map(job => (
                        <div key={job.mediaId} className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            <span className="text-sm text-gray-300 truncate">{job.fileName}</span>
                        </div>
                    ))}

                    {/* Failed jobs */}
                    {failedJobs.map(job => (
                        <div key={job.mediaId} className="flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <span className="text-sm text-gray-300 truncate">{job.fileName}</span>
                        </div>
                    ))}

                    {/* Queue info */}
                    {queuedCount > 0 && (
                        <div className="text-xs text-gray-500 pt-2 border-t border-gray-700">
                            {queuedCount} file{queuedCount !== 1 ? 's' : ''} waiting in queue
                        </div>
                    )}

                    {/* Queue all button */}
                    <button
                        onClick={queueAll}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Convert All Incompatible
                    </button>
                </div>
            )}
        </div>
    );
}
