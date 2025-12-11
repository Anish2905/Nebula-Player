# Nebula Player - Batch Media Converter
# Converts incompatible audio codecs (EAC3, AC3, DTS) to AAC for browser playback
# Video stream is copied directly (no re-encoding) - fast and lossless

param(
    [string]$InputPath = "",
    [string]$OutputPath = "",
    [switch]$DryRun = $false,
    [switch]$Help = $false
)

if ($Help) {
    Write-Host @"
Nebula Player - Batch Media Converter

Usage:
    .\convert-media.ps1 -InputPath "D:\Movies" -OutputPath "D:\Movies_Converted"
    .\convert-media.ps1 -InputPath "D:\Movies" -OutputPath "D:\Movies_Converted" -DryRun

Options:
    -InputPath    Source folder containing media files
    -OutputPath   Destination folder for converted files
    -DryRun       Show what would be converted without actually converting
    -Help         Show this help message

Examples:
    # Convert all files in D:\Movies to D:\Movies_Converted
    .\convert-media.ps1 -InputPath "D:\Movies" -OutputPath "D:\Movies_Converted"
    
    # Preview what would be converted
    .\convert-media.ps1 -InputPath "D:\Movies" -OutputPath "D:\Movies_Converted" -DryRun
"@
    exit 0
}

# Validate inputs
if (-not $InputPath -or -not $OutputPath) {
    Write-Host "Error: Both -InputPath and -OutputPath are required." -ForegroundColor Red
    Write-Host "Use -Help for usage information."
    exit 1
}

if (-not (Test-Path $InputPath)) {
    Write-Host "Error: Input path does not exist: $InputPath" -ForegroundColor Red
    exit 1
}

# Create output directory if it doesn't exist
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
    Write-Host "Created output directory: $OutputPath" -ForegroundColor Green
}

# Check if FFmpeg is available
try {
    $null = & ffmpeg -version 2>&1
} catch {
    Write-Host "Error: FFmpeg not found. Please install FFmpeg and add it to PATH." -ForegroundColor Red
    exit 1
}

# Video extensions to process
$videoExtensions = @(".mkv", ".mp4", ".avi", ".mov", ".wmv", ".m4v", ".webm")

# Find all video files
Write-Host "`n🔍 Scanning for video files in: $InputPath" -ForegroundColor Cyan
$videos = Get-ChildItem -Path $InputPath -Recurse -File | Where-Object { 
    $videoExtensions -contains $_.Extension.ToLower() 
}

Write-Host "Found $($videos.Count) video files`n" -ForegroundColor Cyan

# Stats
$converted = 0
$skipped = 0
$failed = 0

foreach ($video in $videos) {
    $relativePath = $video.FullName.Substring($InputPath.Length).TrimStart('\', '/')
    $outputFile = Join-Path $OutputPath ($relativePath -replace '\.[^.]+$', '.mp4')
    $outputDir = Split-Path $outputFile -Parent
    
    # Ensure output subdirectory exists
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    
    # Skip if output already exists
    if (Test-Path $outputFile) {
        Write-Host "⏭️ Already exists: $relativePath" -ForegroundColor DarkGray
        $skipped++
        continue
    }
    
    # Get audio codec info using ffprobe
    $ffprobeOutput = & ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 $video.FullName 2>&1
    $audioCodec = $ffprobeOutput -join ""
    
    # Check if audio needs conversion
    $compatibleCodecs = @("aac", "mp3", "opus", "vorbis", "flac")
    $needsConversion = $true
    foreach ($codec in $compatibleCodecs) {
        if ($audioCodec -match $codec) {
            $needsConversion = $false
            break
        }
    }
    
    if (-not $needsConversion) {
        Write-Host "✅ Compatible: $relativePath ($audioCodec)" -ForegroundColor Green
        
        if (-not $DryRun) {
            # Just copy the file if it's already compatible
            Copy-Item $video.FullName $outputFile
        }
        $skipped++
        continue
    }
    
    Write-Host "🔄 Converting: $relativePath ($audioCodec → AAC)" -ForegroundColor Yellow
    
    if ($DryRun) {
        continue
    }
    
    # Convert: copy video, transcode audio to AAC
    $tempFile = "$outputFile.tmp"
    
    try {
        $ffmpegArgs = @(
            "-i", $video.FullName,
            "-map", "0:v:0",
            "-map", "0:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-ac", "2",
            "-b:a", "192k",
            "-movflags", "+faststart",
            "-y",
            $tempFile
        )
        
        $process = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -eq 0 -and (Test-Path $tempFile)) {
            Move-Item $tempFile $outputFile -Force
            Write-Host "   ✓ Done: $outputFile" -ForegroundColor Green
            $converted++
        } else {
            Write-Host "   ✗ Failed: FFmpeg error" -ForegroundColor Red
            if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
            $failed++
        }
    } catch {
        Write-Host "   ✗ Error: $_" -ForegroundColor Red
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force }
        $failed++
    }
}

# Summary
Write-Host "`n" + "=" * 50 -ForegroundColor Cyan
Write-Host "📊 Conversion Summary" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "   Converted: $converted" -ForegroundColor Green
Write-Host "   Skipped:   $skipped" -ForegroundColor DarkGray
Write-Host "   Failed:    $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "DarkGray" })
Write-Host ""

if ($DryRun) {
    Write-Host "This was a dry run. No files were actually converted." -ForegroundColor Yellow
    Write-Host "Remove -DryRun to perform actual conversion." -ForegroundColor Yellow
}

Write-Host "`n✨ Done! Update your Nebula Player scan path to: $OutputPath" -ForegroundColor Cyan
