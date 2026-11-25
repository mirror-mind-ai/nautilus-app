<#
.SYNOPSIS
    Install Nautilus for Mirror on Windows from PowerShell:

        irm https://raw.githubusercontent.com/mirror-mind-ai/nautilus-app/main/get.ps1 | iex

.DESCRIPTION
    Downloads the latest released installer and its SHA256SUMS, checks the file
    against the published hash, and opens the installer, the same wizard as the
    .exe downloaded by hand. It installs for the current user, with no
    administrator password.

    Why this exists: Windows SmartScreen warns about a file that carries the
    "mark of the web", which a browser writes on every download, while the
    .exe is not code-signed. A file PowerShell downloads carries no such mark,
    so the wizard opens without the warning; the SHA-256 check takes the place
    of the browser's reputation check. If the hash does not match, nothing is
    run and the file is deleted.

    The same form, and the same reasons, as the Mirror Mind installer's
    get.ps1 (github.com/mirror-mind-ai/mirror-installer).

    Optional, through the environment:
      NAUTILUS_INSTALLER_URL            where to download from (default: the
                                        release channel's stable download); a
                                        mirror, or a test server
      NAUTILUS_INSTALLER_DOWNLOAD_ONLY  1 = download and check, print the path,
                                        do not open the installer
#>
& {
    $ErrorActionPreference = "Stop"
    $ProgressPreference = "SilentlyContinue"   # Windows PowerShell 5.1 crawls when it draws progress
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $pt = (Get-Culture).Name -like "pt*"
    function Say([string]$en, [string]$ptText) { Write-Host ("Nautilus: " + $(if ($pt) { $ptText } else { $en })) }

    $base = if ($env:NAUTILUS_INSTALLER_URL) { $env:NAUTILUS_INSTALLER_URL.TrimEnd("/") } else { "https://updates.mirrormind.sh/nautilus/downloads/windows" }
    $name = "nautilus-latest-setup.exe"
    $dir = Join-Path $env:TEMP ("Nautilus-Setup-" + [Guid]::NewGuid().ToString("N").Substring(0, 8))
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    $sums = (Invoke-WebRequest -UseBasicParsing -Uri "$base/SHA256SUMS").Content
    if ($sums -is [byte[]]) { $sums = [Text.Encoding]::ASCII.GetString($sums) }
    $lines = @($sums -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    # One line, naming the stable download and nothing else: anything different is not ours to run.
    if ($lines.Count -ne 1 -or $lines[0] -notmatch "^([0-9a-fA-F]{64})\s+nautilus-latest-setup\.exe$") {
        Remove-Item -Recurse -Force $dir
        throw "SHA256SUMS at $base does not name $name alone. Nothing was run."
    }
    $expected = $Matches[1]
    $exe = Join-Path $dir $name

    $version = try { (Invoke-RestMethod -Uri "$base/latest.json").version } catch { $null }
    $what = if ($version) { "Nautilus for Mirror $version" } else { "Nautilus for Mirror" }
    Say "downloading $what" "baixando $what"
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$name" -OutFile $exe
    # .NET's hash, not Get-FileHash: Windows PowerShell started from PowerShell 7 inherits its module
    # path and no longer finds that command (met on a GitHub runner). The check must not depend on it.
    $stream = [IO.File]::OpenRead($exe)
    try { $actual = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($stream)).Replace("-", "") } finally { $stream.Dispose() }
    if ($actual -ne $expected.ToUpperInvariant()) {
        Remove-Item -Recurse -Force $dir
        throw "SHA-256 mismatch for ${name}: expected $expected, got $actual. Nothing was run."
    }
    # A PowerShell download carries no mark of the web today; clear it in case
    # a later PowerShell writes one. The hash above is the check that matters.
    try { Unblock-File -Path $exe } catch { }
    Say "SHA-256 verified" "SHA-256 conferido"

    if ($env:NAUTILUS_INSTALLER_DOWNLOAD_ONLY -eq "1") { Write-Output $exe; return }
    Say "opening the installer" "abrindo o instalador"
    Start-Process -FilePath $exe -Wait
    Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
}
