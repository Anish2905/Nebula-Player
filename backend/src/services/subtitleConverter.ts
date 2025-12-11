/**
 * Subtitle Converter - Converts SRT to WebVTT format
 */

import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

/**
 * Convert SRT subtitle format to WebVTT
 */
export function srtToVtt(srtContent: string): string {
    // WebVTT header
    let vtt = 'WEBVTT\n\n';

    // Split into blocks
    const blocks = srtContent.trim().split(/\n\n+/);

    for (const block of blocks) {
        const lines = block.split('\n');

        if (lines.length < 2) continue;

        // Find timestamp line (skip sequence number)
        let timestampIndex = 0;
        if (lines[0].match(/^\d+$/)) {
            timestampIndex = 1;
        }

        if (timestampIndex >= lines.length) continue;

        const timestampLine = lines[timestampIndex];

        // Convert timestamp format: 00:00:00,000 --> 00:00:00,000
        // to WebVTT format: 00:00:00.000 --> 00:00:00.000
        const vttTimestamp = timestampLine.replace(/,/g, '.');

        // Get subtitle text (everything after timestamp)
        const textLines = lines.slice(timestampIndex + 1);
        const text = textLines.join('\n');

        if (vttTimestamp && text) {
            vtt += `${vttTimestamp}\n${text}\n\n`;
        }
    }

    return vtt;
}

/**
 * Convert an SRT file to WebVTT and save it
 */
export async function convertSrtFile(srtPath: string, outputPath?: string): Promise<string> {
    const srtContent = fs.readFileSync(srtPath, 'utf-8');
    const vttContent = srtToVtt(srtContent);

    // Determine output path
    const vttPath = outputPath || srtPath.replace(/\.srt$/i, '.vtt');

    // Ensure directory exists
    const dir = path.dirname(vttPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(vttPath, vttContent, 'utf-8');

    return vttPath;
}

/**
 * Extract an embedded subtitle track to a VTT file
 */
export function extractEmbeddedSubtitle(
    inputPath: string,
    trackIndex: number,
    outputPath: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        console.log(`Extracting subtitle track ${trackIndex} from ${inputPath} to ${outputPath}`);

        ffmpeg(inputPath)
            .outputOptions([
                `-map 0:${trackIndex}`, // Select specific stream
                '-f webvtt'             // Output format
            ])
            .output(outputPath)
            .on('end', () => {
                console.log(`Subtitle extraction complete: ${outputPath}`);
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error(`Subtitle extraction failed: ${err.message}`);
                reject(err);
            })
            .run();
    });
}

/**
 * Extract language code from subtitle filename
 * e.g., "Movie.en.srt" -> "en"
 */
export function extractLanguageFromFilename(filename: string): string {
    const baseName = path.basename(filename, path.extname(filename));
    const parts = baseName.split('.');

    // Check last part for language code
    if (parts.length > 1) {
        const lastPart = parts[parts.length - 1].toLowerCase();

        // Common 2-3 letter language codes
        const langCodes = ['en', 'eng', 'es', 'spa', 'fr', 'fre', 'de', 'ger', 'it', 'ita',
            'pt', 'por', 'ru', 'rus', 'ja', 'jpn', 'ko', 'kor', 'zh', 'chi',
            'hi', 'hin', 'ar', 'ara', 'nl', 'dut', 'sv', 'swe', 'no', 'nor'];

        if (langCodes.includes(lastPart)) {
            return lastPart;
        }

        // Check for language.forced or language.sdh patterns
        if (parts.length > 2) {
            const secondLast = parts[parts.length - 2].toLowerCase();
            if (langCodes.includes(secondLast)) {
                return secondLast;
            }
        }
    }

    return 'und'; // Unknown
}
