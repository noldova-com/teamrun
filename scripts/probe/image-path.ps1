param([string[]]$Programs)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class ImagePathProbe {
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, int id);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageNameW(IntPtr process, int flags, StringBuilder path, ref int length);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  public static string Read(int id, int flags) {
    IntPtr handle = OpenProcess(0x1000, false, id);
    if (handle == IntPtr.Zero) return "OpenProcess failed " + Marshal.GetLastWin32Error();
    try {
      StringBuilder path = new StringBuilder(32768);
      int length = path.Capacity;
      return QueryFullProcessImageNameW(handle, flags, path, ref length) ? path.ToString() : "failed " + Marshal.GetLastWin32Error();
    } finally { CloseHandle(handle); }
  }
}
"@
foreach ($program in ($Programs -join ',') -split ',') {
  Write-Output "PROBE link     $((Get-Item (Split-Path (Split-Path $program))).LinkType) $((Get-Item (Split-Path (Split-Path $program))).Target)"
  $child = Start-Process -FilePath $program -ArgumentList '-e', 'setInterval(Object,1000)' -PassThru -NoNewWindow
  Start-Sleep -Seconds 2
  Write-Output "PROBE program  $program"
  Write-Output "PROBE win32    $([ImagePathProbe]::Read($child.Id, 0))"
  Write-Output "PROBE native   $([ImagePathProbe]::Read($child.Id, 1))"
  Write-Output "PROBE stat     $(node -e "const fs=require('fs');const a=fs.statSync(process.argv[1],{bigint:true});console.log(a.dev,a.ino)" $program)"
  Stop-Process -Id $child.Id -Force
}
