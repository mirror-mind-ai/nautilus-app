<#
.SYNOPSIS
    Install a Nautilus NSIS installer for the current user, launch the app, close it and uninstall,
    checking what a person would meet. Used by the Windows CI job; runs on Windows PowerShell 5.1.

.DESCRIPTION
    The installer is run silently (/S), the way an update or a scripted install runs it. Checked:
      - the installer exits 0 and registers the product with the expected version;
      - the registered executable, the bundled Node of the Mirror host and a Start menu shortcut exist;
      - the app starts and is still running after a few seconds (a missing DLL or a crash at start
        ends it at once);
      - a silent uninstall exits 0 and removes the executable, the shortcut and the registration,
        and keeps the app data (the uninstaller deletes it only when its checkbox is ticked).
    Exits 1 on the first failed check.
#>
param(
    [Parameter(Mandatory = $true)][string]$Installer,
    [Parameter(Mandatory = $true)][string]$ProductName,
    [Parameter(Mandatory = $true)][string]$Identifier,
    [Parameter(Mandatory = $true)][string]$Version,
    [int]$AliveSeconds = 15
)
$ErrorActionPreference = 'Stop'
$failures = 0
function Check([string]$what, [bool]$ok, [string]$detail) {
    $mark = if ($ok) { 'PASS' } else { 'FAIL' }
    Write-Output "$mark $what - $detail"
    if (-not $ok) { $script:failures++ }
}
function Finish {
    if ($script:failures -gt 0) { Write-Output "$($script:failures) check(s) failed"; exit 1 }
    Write-Output 'all checks passed'; exit 0
}
$uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$ProductName"

$install = Start-Process -FilePath $Installer -ArgumentList '/S' -PassThru -Wait
Check 'installer exit code' ($install.ExitCode -eq 0) "exit=$($install.ExitCode)"
$entry = Get-ItemProperty -Path $uninstallKey -ErrorAction SilentlyContinue
Check 'registered for the current user' ($null -ne $entry) $uninstallKey
if ($null -eq $entry) { Finish }
Check 'registered version' ($entry.DisplayVersion -eq $Version) "DisplayVersion=$($entry.DisplayVersion) expected=$Version"

$installDir = $entry.InstallLocation.Trim('"')
$exe = Join-Path $installDir $entry.MainBinaryName
Check 'executable installed' (Test-Path $exe) $exe
Check 'Mirror host Node bundled' (Test-Path (Join-Path $installDir 'mirror-host\node\node.exe')) $installDir
$shortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$ProductName.lnk"
Check 'Start menu shortcut' (Test-Path $shortcut) $shortcut

$app = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds $AliveSeconds
$app.Refresh()
Check 'app still running after start' (-not $app.HasExited) "pid=$($app.Id) after $AliveSeconds s$(if ($app.HasExited) { ", exit=$($app.ExitCode)" })"
if (-not $app.HasExited) { Stop-Process -Id $app.Id -Force; Start-Sleep -Seconds 3 }

$appData = Join-Path $env:APPDATA $Identifier
New-Item -ItemType Directory -Force -Path $appData | Out-Null
$marker = Join-Path $appData 'install-smoke-marker.txt'
Set-Content -Path $marker -Value 'kept across uninstall'

$uninstaller = Join-Path $installDir 'uninstall.exe'
$uninstall = Start-Process -FilePath $uninstaller -ArgumentList '/S' -PassThru -Wait
# The NSIS uninstaller copies itself to a temporary folder and returns before the files are gone.
$deadline = (Get-Date).AddSeconds(60)
while ((Test-Path $exe) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 1 }
Check 'uninstaller exit code' ($uninstall.ExitCode -eq 0) "exit=$($uninstall.ExitCode)"
Check 'executable removed' (-not (Test-Path $exe)) $exe
Check 'shortcut removed' (-not (Test-Path $shortcut)) $shortcut
Check 'registration removed' (-not (Test-Path $uninstallKey)) $uninstallKey
Check 'app data kept' (Test-Path $marker) $marker
Remove-Item -Path $marker -Force -ErrorAction SilentlyContinue
Finish
