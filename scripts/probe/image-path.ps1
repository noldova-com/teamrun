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
$electron = (Resolve-Path 'app\node_modules\electron\dist\electron.exe').Path
$env:ELECTRON_RUN_AS_NODE = '1'
$child = Start-Process -FilePath $electron -ArgumentList '-e', 'setTimeout(() => {}, 20000)' -PassThru -NoNewWindow
Start-Sleep -Seconds 2
Write-Output "PROBE started   $electron"
Write-Output "PROBE win32     $([ImagePathProbe]::Read($child.Id, 0))"
Write-Output "PROBE native    $([ImagePathProbe]::Read($child.Id, 1))"
Write-Output "PROBE volume    $((Get-Item 'C:\a\teamrun').Target) $(mountvol 'C:\a\teamrun\' /L)"
Stop-Process -Id $child.Id -Force
