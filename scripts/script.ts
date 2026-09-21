/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import readline from "node:readline";

export default abstract class Script {
  private static readonly NPM_EXECUTABLE_PATH_VARIABLE: string = "npm_execpath";
  private static readonly NPM_EXECUTABLE_PATH_UNAVAILABLE: string = "npm_execpath is unavailable. Run the scripts through npm.";
  private static readonly TYPESCRIPT_PACKAGE_MANIFEST: string = "typescript/package.json";
  private static readonly TYPESCRIPT_COMPILER_PATH: string = "bin/tsc";

  public abstract runAsync(): Promise<void>;

  protected executeProcessAsync(
    command: string,
    commandArguments: readonly string[],
    workingDirectory: string,
    silent: boolean = false,
    environment?: Readonly<Record<string, string>>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, commandArguments, {
        cwd: workingDirectory,
        stdio: silent ? ["ignore", "ignore", "inherit"] : "inherit",
        shell: false,
        env: environment === undefined ? process.env : { ...process.env, ...environment }
      });
      child.on("error", reject);
      child.on("exit", (code, signal) => {
        if (code === 0)
          resolve();
        else
          reject(new Error(`"${command}" exited with ${code === null ? `signal ${signal}` : `code ${code}`}.`));
      });
    });
  }

  protected executeNpmCommandAsync(npmArguments: readonly string[], workingDirectory: string, silent: boolean = false): Promise<void> {
    const npmPath = process.env[Script.NPM_EXECUTABLE_PATH_VARIABLE];
    if (npmPath === undefined || npmPath.length === 0)
      throw new Error(Script.NPM_EXECUTABLE_PATH_UNAVAILABLE);
    return this.executeProcessAsync(process.execPath, [npmPath, ...npmArguments], workingDirectory, silent);
  }

  protected executeTypeScriptCompilerAsync(compilerArguments: readonly string[], workingDirectory: string = process.cwd()): Promise<void> {
    const manifestPath = createRequire(import.meta.url).resolve(Script.TYPESCRIPT_PACKAGE_MANIFEST);
    const compilerPath = path.join(path.dirname(manifestPath), Script.TYPESCRIPT_COMPILER_PATH);
    return this.executeProcessAsync(process.execPath, [compilerPath, ...compilerArguments], workingDirectory);
  }

  protected writeLog(message: string, overwrite: boolean = false): void {
    if (overwrite && process.stdout.isTTY) {
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 1);
    }
    process.stdout.write(`${message}\n`);
  }

  protected async pathExistsAsync(targetPath: string): Promise<boolean> {
    try {
      await access(targetPath);
      return true;
    }
    catch {
      return false;
    }
  }

  protected async createDirectoryAsync(directoryPath: string): Promise<void> {
    await mkdir(directoryPath, { recursive: true });
  }

  protected async removeDirectoryAsync(directoryPath: string): Promise<void> {
    await rm(directoryPath, { recursive: true, force: true });
  }

  protected async copyFileAsync(sourcePath: string, targetPath: string): Promise<void> {
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }

  protected readBinaryAsync(filePath: string): Promise<Buffer> {
    return readFile(filePath);
  }

  protected writeBinaryAsync(filePath: string, content: Buffer): Promise<void> {
    return writeFile(filePath, content);
  }

  protected removeFileAsync(filePath: string): Promise<void> {
    return rm(filePath, { force: true });
  }

  protected readFileAsync(filePath: string): Promise<string> {
    return readFile(filePath, "utf8");
  }

  protected writeFileAsync(filePath: string, content: string): Promise<void> {
    return writeFile(filePath, content, "utf8");
  }
}
