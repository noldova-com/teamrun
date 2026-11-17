/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";

import { type Page, expect } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

interface ISystemContrast {
  readonly flags: number;
  readonly scheme: string;
}

const VARIABLE = "TEAMRUN_E2E_HIGH_CONTRAST";
const ON = 1;
const SCHEME = "High Contrast Black";

const contrast = (write: ISystemContrast | null): ISystemContrast => {
  const [flags, ...scheme] = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class SystemContrast {
  [StructLayout(LayoutKind.Sequential)]
  public struct HIGHCONTRAST { public int cbSize; public int dwFlags; public IntPtr lpszDefaultScheme; }
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool SystemParametersInfo(int action, int param, ref HIGHCONTRAST value, int ini);
  public static string Read() {
    var value = new HIGHCONTRAST();
    value.cbSize = Marshal.SizeOf(value);
    SystemParametersInfo(0x42, value.cbSize, ref value, 0);
    return value.dwFlags + "|" + (value.lpszDefaultScheme == IntPtr.Zero ? "" : Marshal.PtrToStringUni(value.lpszDefaultScheme));
  }
  public static string Write(int flags, string scheme) {
    var value = new HIGHCONTRAST();
    value.cbSize = Marshal.SizeOf(value);
    value.dwFlags = flags;
    value.lpszDefaultScheme = scheme.Length == 0 ? IntPtr.Zero : Marshal.StringToHGlobalUni(scheme);
    try {
      SystemParametersInfo(0x43, value.cbSize, ref value, 3);
    } finally {
      if (value.lpszDefaultScheme != IntPtr.Zero)
        Marshal.FreeHGlobal(value.lpszDefaultScheme);
    }
    return Read();
  }
}
"@
if ($env:TEAMRUN_CONTRAST_FLAGS) { [SystemContrast]::Write([int]$env:TEAMRUN_CONTRAST_FLAGS, [string]$env:TEAMRUN_CONTRAST_SCHEME) } else { [SystemContrast]::Read() }
`], {
    encoding: "utf8",
    env: { ...process.env, TEAMRUN_CONTRAST_FLAGS: write === null ? "" : String(write.flags), TEAMRUN_CONTRAST_SCHEME: write?.scheme ?? "" }
  }).trim().split("|");
  return { flags: Number(flags), scheme: scheme.join("|") };
};

const lookAsync = (page: Page): Promise<{ readonly forced: boolean; readonly inSystemColours: boolean }> => page.evaluate(() => {
  const sample = document.body.appendChild(document.createElement("div"));
  sample.style.setProperty("background-color", "Canvas");
  sample.style.setProperty("color", "CanvasText");
  const [body, system] = [getComputedStyle(document.body), getComputedStyle(sample)];
  const inSystemColours = body.backgroundColor === system.backgroundColor && body.color === system.color;
  sample.remove();
  return { forced: matchMedia("(forced-colors: active)").matches, inSystemColours };
});

test.describe("Windows High Contrast", () => {
  let saved: ISystemContrast | null = null;

  test.afterEach(() => {
    if (saved !== null)
      contrast(saved);
    saved = null;
  });

  test("turns forced colours on in the system's colours when the system setting turns on, and off when it turns off", async ({ app }) => {
    test.skip(process.platform !== "win32" || process.env[VARIABLE] !== "1", `Windows only, with ${VARIABLE}=1, since it changes the system's contrast setting`);
    const before = contrast(null);
    saved = before;
    const page = await app.startAsync();
    await page.emulateMedia({ forcedColors: null, colorScheme: null, contrast: null });
    expect(contrast({ flags: before.flags | ON, scheme: before.scheme.length > 0 ? before.scheme : SCHEME }).flags & ON).toBe(ON);
    await expect.poll(() => lookAsync(page), TeamRunApp.pollOf()).toEqual({ forced: true, inSystemColours: true });
    expect(contrast({ flags: before.flags & ~ON, scheme: before.scheme }).flags & ON).toBe(0);
    await expect.poll(async () => (await lookAsync(page)).forced, TeamRunApp.pollOf()).toBe(false);
  });
});
