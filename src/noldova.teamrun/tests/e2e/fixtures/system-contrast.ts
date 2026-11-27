/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync, spawnSync } from "node:child_process";

import "@noldova/context.core";

export class SystemContrast {
  public static readonly FLAGS_VARIABLE: string = "TEAMRUN_CONTRAST_FLAGS";
  public static readonly SCHEME_VARIABLE: string = "TEAMRUN_CONTRAST_SCHEME";
  private static readonly REGISTRY_KEY: string = "HKCU\\Control Panel\\Accessibility\\HighContrast";
  private static readonly REGISTRY_FLAGS: RegExp = /^\s*Flags\s+REG_SZ\s+(\d+)\s*$/m;
  public static readonly SCRIPT: string = [
    "$marshal = [System.Runtime.InteropServices.Marshal]",
    "$assembly = [AppDomain]::CurrentDomain.DefineDynamicAssembly([System.Reflection.AssemblyName]::new('SystemContrast'), "
      + "[System.Reflection.Emit.AssemblyBuilderAccess]::Run)",
    "$builder = $assembly.DefineDynamicModule('SystemContrast').DefineType('SystemContrast', 'Public, Abstract, Sealed')",
    "$method = $builder.DefinePInvokeMethod('SystemParametersInfoW', 'user32.dll', 'Public, Static, PinvokeImpl', [System.Reflection.CallingConventions]::Standard, "
      + "[bool], [Type[]]@([int], [int], [IntPtr], [int]), [System.Runtime.InteropServices.CallingConvention]::Winapi, [System.Runtime.InteropServices.CharSet]::Unicode)",
    "$method.SetImplementationFlags('PreserveSig')",
    "$native = $builder.CreateType()",
    "$size = 8 + [IntPtr]::Size",
    "$value = $marshal::AllocHGlobal($size)",
    "try { $marshal::WriteInt32($value, 0, $size)",
    `if ($env:${SystemContrast.FLAGS_VARIABLE}) { $scheme = [IntPtr]::Zero; if ($env:${SystemContrast.SCHEME_VARIABLE}) { `
      + `$scheme = $marshal::StringToHGlobalUni($env:${SystemContrast.SCHEME_VARIABLE}) }; try { $marshal::WriteInt32($value, 4, [int]$env:${SystemContrast.FLAGS_VARIABLE}); `
      + "$marshal::WriteIntPtr($value, 8, $scheme); $null = $native::SystemParametersInfoW(0x43, $size, $value, 3) } "
      + "finally { if ($scheme -ne [IntPtr]::Zero) { $marshal::FreeHGlobal($scheme) } } }",
    "$marshal::WriteInt32($value, 0, $size); $null = $native::SystemParametersInfoW(0x42, $size, $value, 0); $pointer = $marshal::ReadIntPtr($value, 8)",
    "'{0}|{1}' -f $marshal::ReadInt32($value, 4), $(if ($pointer -eq [IntPtr]::Zero) { '' } else { $marshal::PtrToStringUni($pointer) }) } "
      + "finally { $marshal::FreeHGlobal($value) }"
  ].join("; ");

  public readonly flags: number;
  public readonly scheme: string;

  public constructor(flags: number, scheme: string) {
    this.flags = flags;
    this.scheme = scheme;
  }

  public static apply(write: SystemContrast | null): SystemContrast {
    return SystemContrast.of(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", SystemContrast.SCRIPT],
      { encoding: "utf8", env: SystemContrast.environmentOf(write) }));
  }

  public static environmentOf(write: SystemContrast | null): NodeJS.ProcessEnv {
    return { ...process.env, [SystemContrast.FLAGS_VARIABLE]: Object.isNull(write) ? String.empty : String(write.flags),
      [SystemContrast.SCHEME_VARIABLE]: write?.scheme ?? String.empty };
  }

  public static registeredFlags(): number {
    const answer = spawnSync("reg", ["query", SystemContrast.REGISTRY_KEY, "/v", "Flags"], { encoding: "utf8" });
    return Number(SystemContrast.REGISTRY_FLAGS.exec(answer.stdout)?.[1]);
  }

  public static of(output: string): SystemContrast {
    const [flags, ...scheme] = output.trim().split("|");
    return new SystemContrast(Number(flags), scheme.join("|"));
  }
}
