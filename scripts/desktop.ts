/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import BuildEvidence from "./build-evidence.ts";

class Desktop {
  private static readonly MAIN: string = "node_modules/@noldova/teamrun-desktop/main.js";
  private static readonly RENDERER: string = "_build/renderer/browser/index.html";

  public async runAsync(): Promise<void> {
    await BuildEvidence.requireCurrent();
    await access(Desktop.RENDERER);
    const executable: unknown = createRequire(import.meta.url)("electron");
    if (typeof executable !== "string")
      throw new Error("The Electron package did not provide an executable path.");

    const environment = { ...process.env };
    delete environment["ELECTRON_RUN_AS_NODE"];
    const child = spawn(executable, [path.resolve(Desktop.MAIN), ...process.argv.slice(2)], { cwd: process.cwd(), env: environment, stdio: "inherit" });
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0)
          resolve();
        else
          reject(new Error(`The desktop exited with ${code === null ? `signal ${signal}` : `code ${code}`}.`));
      });
    });
  }
}

await new Desktop().runAsync();
