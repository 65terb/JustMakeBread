[CmdletBinding()]
param(
    [string]$RepoRoot = '',
    [string]$ManifestPath = '',
    [string]$OutputRoot = '',
    [string]$Timestamp = '',
    [string]$StagingRoot = ''
)

$ErrorActionPreference = 'Stop'

function Resolve-FullPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $Path).Path)
}

function Assert-NoReparsePoint {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Description
    )

    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Export path cannot use a reparse point ($Description): $Path"
    }
}

function Assert-NoReparsePointsInRepoPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    Assert-NoReparsePoint -Path $Root -Description 'repository root'
    $currentPath = $Root
    foreach ($segment in $RelativePath.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries)) {
        $currentPath = Join-Path $currentPath $segment
        if (-not (Test-Path -LiteralPath $currentPath)) {
            break
        }
        Assert-NoReparsePoint -Path $currentPath -Description "manifest component '$segment'"
    }
}

function Remove-StagingDirectoryStrict {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    } catch {
        throw "Failed to clean staging directory '$Path': $($_.Exception.Message)"
    }

    if (Test-Path -LiteralPath $Path) {
        throw "Failed to clean staging directory '$Path': it still exists after removal."
    }
}

function Get-Sha256Hex {
    param([Parameter(Mandatory = $true)][string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $algorithm.ComputeHash($stream)
        return ([System.BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    } finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

function Test-PathWithinRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Root
    )

    $rootWithSeparator = if ($Root.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $Root
    } else {
        $Root + [System.IO.Path]::DirectorySeparatorChar
    }

    return $Path.Equals($Root, [System.StringComparison]::OrdinalIgnoreCase) -or
        $Path.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Join-Path $PSScriptRoot '..'
}
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $PSScriptRoot 'chatgpt-source-files.json'
}

$repoInputItem = Get-Item -LiteralPath $RepoRoot -Force -ErrorAction Stop
if (($repoInputItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "Repository root cannot be a reparse point: $RepoRoot"
}
$repoFullPath = Resolve-FullPath $RepoRoot
$manifestFullPath = Resolve-FullPath $ManifestPath

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
    $OutputRoot = Join-Path $repoFullPath 'project_exports/chatgpt_project_sources'
} elseif (-not [System.IO.Path]::IsPathRooted($OutputRoot)) {
    $OutputRoot = Join-Path $repoFullPath $OutputRoot
}
$outputFullPath = [System.IO.Path]::GetFullPath($OutputRoot)

if ([string]::IsNullOrWhiteSpace($StagingRoot)) {
    $StagingRoot = [System.IO.Path]::GetTempPath()
} elseif (-not [System.IO.Path]::IsPathRooted($StagingRoot)) {
    $StagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) $StagingRoot
}
$stagingParentPath = [System.IO.Path]::GetFullPath($StagingRoot)

try {
    $manifest = Get-Content -LiteralPath $manifestFullPath -Raw | ConvertFrom-Json
} catch {
    throw "Invalid export manifest: $manifestFullPath. $($_.Exception.Message)"
}

if ($null -eq $manifest.projectSlug -or $manifest.projectSlug -isnot [string] -or
    $manifest.projectSlug -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') {
    throw 'Manifest projectSlug must contain only lowercase letters, digits, and hyphens.'
}

if ($null -eq $manifest.files) {
    throw 'Export manifest must contain a files array.'
}

$manifestFiles = @($manifest.files)
$seenPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
$sourceEntries = @()
$bannedSegments = @('.git', 'node_modules', 'dist', 'build', 'cache', '.cache', 'tmp', 'temp', 'project_exports', 'user-data', 'userdata', '.local', 'private', 'save')
$bannedExtensions = @('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp3', '.wav', '.ogg', '.mp4', '.mov', '.avi', '.glb', '.gltf', '.fbx', '.obj', '.blend', '.ts', '.tsx', '.js', '.jsx', '.py', '.ps1', '.sh', '.css', '.html', '.sql')

foreach ($entry in $manifestFiles) {
    if ($entry -isnot [string] -or [string]::IsNullOrWhiteSpace($entry)) {
        throw 'Every export manifest file entry must be a non-empty relative path.'
    }

    $relativePath = $entry.Replace('\', '/')
    if ($relativePath.IndexOf([char]0) -ge 0 -or [System.IO.Path]::IsPathRooted($relativePath) -or
        $relativePath -match '^[A-Za-z]:') {
        throw "Export path must be repo-relative: $entry"
    }

    $segments = @($relativePath.Split('/', [System.StringSplitOptions]::RemoveEmptyEntries))
    if ($segments.Count -eq 0 -or $segments -contains '.' -or $segments -contains '..') {
        throw "Export path cannot contain traversal segments: $entry"
    }

    $lowerSegments = @($segments | ForEach-Object { $_.ToLowerInvariant() })
    foreach ($segment in $lowerSegments) {
        if ($bannedSegments -contains $segment -or $segment.StartsWith('.env')) {
            throw "Export path contains a forbidden segment: $entry"
        }
    }
    for ($index = 0; $index -lt $lowerSegments.Count - 1; $index++) {
        if ($lowerSegments[$index] -eq '.agents' -and $lowerSegments[$index + 1] -eq 'skills') {
            throw "Export path contains a forbidden skill directory: $entry"
        }
    }

    $extension = [System.IO.Path]::GetExtension($relativePath).ToLowerInvariant()
    if ($extension -ne '.md') {
        if ($bannedExtensions -contains $extension) {
            throw "Export path contains a forbidden source or media file: $entry"
        }
        throw "Only Markdown files may be exported: $entry"
    }

    $normalizedPath = $segments -join '/'
    if (-not $seenPaths.Add($normalizedPath)) {
        throw "Duplicate export path: $normalizedPath"
    }

    Assert-NoReparsePointsInRepoPath -Root $repoFullPath -RelativePath $normalizedPath
    $sourceFullPath = [System.IO.Path]::GetFullPath((Join-Path $repoFullPath ($normalizedPath -replace '/', [System.IO.Path]::DirectorySeparatorChar)))
    if (-not (Test-PathWithinRoot -Path $sourceFullPath -Root $repoFullPath)) {
        throw "Export path escapes the repository: $entry"
    }
    if (-not (Test-Path -LiteralPath $sourceFullPath -PathType Leaf)) {
        throw "Missing export source file: $normalizedPath"
    }

    $sourceEntries += [ordered]@{
        path = $normalizedPath
        source = $sourceFullPath
    }
}

if ([string]::IsNullOrWhiteSpace($Timestamp)) {
    $Timestamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
}
if ($Timestamp -notmatch '^\d{4}-\d{2}-\d{2}_\d{6}$') {
    throw 'Timestamp must use the format YYYY-MM-DD_HHmmss.'
}

$null = New-Item -ItemType Directory -Path $outputFullPath -Force
$null = New-Item -ItemType Directory -Path $stagingParentPath -Force
$stagingDirectory = Join-Path $stagingParentPath ("track1_chatgpt_sources_{0}" -f ([guid]::NewGuid().ToString('N')))

try {
    $null = New-Item -ItemType Directory -Path $stagingDirectory -Force
    $manifestEntries = @()

    foreach ($sourceEntry in $sourceEntries) {
        $destinationPath = Join-Path $stagingDirectory ($sourceEntry.path -replace '/', [System.IO.Path]::DirectorySeparatorChar)
        $destinationDirectory = Split-Path -Parent $destinationPath
        $null = New-Item -ItemType Directory -Path $destinationDirectory -Force
        Copy-Item -LiteralPath $sourceEntry.source -Destination $destinationPath

        $hash = Get-Sha256Hex -Path $destinationPath
        $manifestEntries += [ordered]@{
            path = $sourceEntry.path
            sha256 = $hash
        }
    }

    $exportManifest = [ordered]@{
        projectSlug = $manifest.projectSlug
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        files = $manifestEntries
    }
    $manifestJson = $exportManifest | ConvertTo-Json -Depth 5
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $stagingDirectory 'CHATGPT_SOURCE_MANIFEST.json'), $manifestJson, $utf8NoBom)

    $baseName = "{0}_chatgpt_sources_{1}" -f $manifest.projectSlug, $Timestamp
    $zipPath = Join-Path $outputFullPath ($baseName + '.zip')
    $suffix = 1
    while (Test-Path -LiteralPath $zipPath) {
        $zipPath = Join-Path $outputFullPath ("{0}_{1:D2}.zip" -f $baseName, $suffix)
        $suffix++
    }

    Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $zipPath -CompressionLevel Optimal
    Write-Output "Created: $zipPath"
} finally {
    if ($stagingDirectory -and (Test-Path -LiteralPath $stagingDirectory)) {
        Remove-StagingDirectoryStrict -Path $stagingDirectory
    }
}
