/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";

const list = "Get-CimInstance Win32_Process | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, $_.CreationDate } | Measure-Object | ForEach-Object Count";
const full = process.env["PSModulePath"] ?? "";
const ci = full.split(";").filter(t => !/[\\/]PowerShell[\\/]/i.test(t)).join(";");
const system = `${process.env["SystemRoot"] ?? "C:\\Windows"}\\system32\\WindowsPowerShell\\v1.0\\Modules`;
const mmi = "$session = [Microsoft.Management.Infrastructure.CimSession]::Create([NullString]::Value); try { foreach ($p in $session.QueryInstances('root/cimv2', 'WQL', 'SELECT ProcessId, ParentProcessId, CreationDate FROM Win32_Process')) { $c = $p.CimInstanceProperties['CreationDate'].Value; '{0} {1} {2}' -f $p.CimInstanceProperties['ProcessId'].Value, $p.CimInstanceProperties['ParentProcessId'].Value, $(if ($c) { ([DateTimeOffset]$c).ToUnixTimeMilliseconds() } else { 'unknown' }) } } finally { $session.Dispose() }";
const variants = [
  ["exit-ci", ci, "exit"],
  ["list-ci", ci, list],
  ["mmi-ci", ci, "& { " + mmi + " } | ForEach-Object { $_ } | Where-Object { $_ } | Out-Null; 'done'"],
  ["mmi-count-ci", ci, "@(" + mmi + ").Count"],
  ["mmi-sample-ci", ci, "@(" + mmi + ")[0..2] -join '; '"],
  ["core-ci", ci, "@(1..5 | ForEach-Object { [pscustomobject]@{ A = $_ } } | Where-Object { $_.A -gt 2 }).Count"],
  ["stringbuilder-ci", ci, "[Text.StringBuilder]::new().Append('x').ToString(); [byte[]]::new(4).Length"],
  ["write-output-ci", ci, "Write-Output 'x'"],
  ["stop-process-ci", ci, "Stop-Process -Id 999999 -Force -ErrorAction SilentlyContinue; 'done'"]
];

function timed(name, modulePath, script) {
  const start = performance.now();
  return new Promise(resolve => {
    let out = "";
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { env: { ...process.env, PSModulePath: modulePath }, windowsHide: true });
    child.stdout.on("data", t => { out += t; });
    child.stderr.on("data", t => { out += t; });
    const limit = setTimeout(() => { child.kill(); }, 90_000);
    child.on("exit", code => {
      clearTimeout(limit);
      resolve(`${name} ${String(Math.round(performance.now() - start))}ms code=${String(code)} ${out.trim().replace(/\s+/g, " ").slice(0, 120)}`);
    });
  });
}

console.log(`PSModulePath full=${full}`);
console.log(`PSModulePath ci=${ci}`);
for (let round = 1; round <= 3; round++)
  for (const [name, modulePath, script] of variants)
    console.log(`round ${String(round)} ` + await timed(name, modulePath, script));
for (const [name, modulePath, script] of variants)
  console.log("parallel4 " + (await Promise.all([1, 2, 3, 4].map(() => timed(name, modulePath, script)))).map(t => t.split(" ").slice(0, 2).join(" ")).join(" | "));
