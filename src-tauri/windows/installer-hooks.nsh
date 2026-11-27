; Before the installer writes its files, the Node processes that still run from this install folder are
; ended. The Mirror host, the learning host and the Pi invocations all run mirror-host\node\node.exe, and
; an update can start while one of them has not left yet. The installer then stops at "Error opening file
; for writing" in its default mode, or leaves the old node.exe in place without a word in the silent one.
;
; Only this folder's Node is matched, by the full path of its executable, so any other Node on the machine
; is left alone. The processes are read and ended through the system's own calls: starting PowerShell for
; it cost four to eight seconds of every installation on a slow machine, and the installer, a 32-bit
; process, cannot read a 64-bit process's path the way PowerShell's Get-Process does.
;
; Each process gets ten seconds to be gone. One that cannot be opened (another account's) is passed over.
; The walk costs two system calls for each process on the machine: about half a second with a few hundred.

!include LogicLib.nsh

Var OwnNodePath
Var OwnNodeSnapshot
Var OwnNodeEntry
Var OwnNodeMore
Var OwnNodeHandle
Var OwnNodeImage

!define OWN_NODE_SNAPSHOT_PROCESSES 2
; PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE
!define OWN_NODE_ACCESS 0x00101001
; sizeof(PROCESSENTRY32W) in a 32-bit process: nine 4-byte fields and 260 wide characters
!define OWN_NODE_ENTRY_SIZE 556

!macro NSIS_HOOK_PREINSTALL
  Push $R8
  Push $R9
  StrCpy $OwnNodePath "$INSTDIR\mirror-host\node\node.exe"
  System::Call 'kernel32::CreateToolhelp32Snapshot(i ${OWN_NODE_SNAPSHOT_PROCESSES}, i 0) p .s'
  Pop $OwnNodeSnapshot
  ${If} $OwnNodeSnapshot <> -1
    System::Call '*(i ${OWN_NODE_ENTRY_SIZE}, i 0, i 0, p 0, i 0, i 0, i 0, i 0, i 0, &w260 "") p .s'
    Pop $OwnNodeEntry
    System::Call 'kernel32::Process32FirstW(p $OwnNodeSnapshot, p $OwnNodeEntry) i .s'
    Pop $OwnNodeMore
    ${While} $OwnNodeMore <> 0
      ; th32ProcessID into $R8 and szExeFile into $R9, in one call
      System::Call '*$OwnNodeEntry(i, i, i .R8, p, i, i, i, i, i, &w260 .R9)'
      ${If} $R9 == "node.exe"
        System::Call 'kernel32::OpenProcess(i ${OWN_NODE_ACCESS}, i 0, i R8) p .s'
        Pop $OwnNodeHandle
        ${If} $OwnNodeHandle <> 0
          StrCpy $OwnNodeImage ""
          System::Call 'kernel32::QueryFullProcessImageNameW(p $OwnNodeHandle, i 0, w .s, *i ${NSIS_MAX_STRLEN}) i'
          Pop $OwnNodeImage
          ${If} $OwnNodeImage == $OwnNodePath
            System::Call 'kernel32::TerminateProcess(p $OwnNodeHandle, i 1) i'
            System::Call 'kernel32::WaitForSingleObject(p $OwnNodeHandle, i 10000) i'
          ${EndIf}
          System::Call 'kernel32::CloseHandle(p $OwnNodeHandle) i'
        ${EndIf}
      ${EndIf}
      System::Call 'kernel32::Process32NextW(p $OwnNodeSnapshot, p $OwnNodeEntry) i .s'
      Pop $OwnNodeMore
    ${EndWhile}
    System::Free $OwnNodeEntry
    System::Call 'kernel32::CloseHandle(p $OwnNodeSnapshot) i'
  ${EndIf}
  Pop $R9
  Pop $R8
!macroend
