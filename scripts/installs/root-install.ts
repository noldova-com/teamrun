/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";
import { setTimeout as delayAsync } from "node:timers/promises";

export class RootInstall {
  public static readonly ARGUMENTS: readonly string[] = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"];
  public static readonly WITH_SCRIPTS_ARGUMENTS: readonly string[] = ["ci", "--no-audit", "--no-fund"];
  public static readonly WITH_SCRIPTS_OPTION: string = "--with-scripts";
  public static readonly RETRY_PAUSE: number = 5000;

  private static readonly MODULES_FOLDER: string = "node_modules";
  private static readonly NPM_VARIABLE: string = "npm_execpath";
  private static readonly LOGS_VARIABLE: string = "npm_config_logs_dir";
  private static readonly LOGS_PREFIX: string = "npm-ci-logs-";
  private static readonly SUCCESS_EXIT_CODE: number = 0;
  private static readonly FAILED_EXIT_CODE: number = 1;
  private static readonly ERROR_CODE_PATTERN: RegExp = /^\d+ error code (ETIMEDOUT|ECONNRESET)\r?$/m;
  private static readonly NETWORK_PATTERN: RegExp = /^\d+ error (syscall read|network aborted)\r?$/m;
  private static readonly REQUEST_PATTERN: RegExp = /^\d+ http fetch /;
  private static readonly LINE_PATTERN: RegExp = /\r?\n/;
  private static readonly REQUEST_LINES: number = 5;
  private static readonly INSTALLING: string = "The root has no node_modules, so npm ci installs the root's and src/'s packages first, with install scripts off.\n";
  private static readonly UNAVAILABLE: string = "The root has no node_modules and npm_execpath is not set; run npm run build, which installs the packages through npm.\n";
  private static readonly UNAVAILABLE_WITH_SCRIPTS: string = "npm_execpath is not set; run npm run install:root, which runs npm ci through npm.\n";

  private readonly root: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly isWithScripts: boolean;
  private readonly waitAsync: (milliseconds: number) => Promise<void>;

  public constructor(root: string, environment: NodeJS.ProcessEnv, output: Writable, isWithScripts: boolean = false,
    waitAsync: (milliseconds: number) => Promise<void> = delayAsync) {
    this.root = root;
    this.environment = environment;
    this.output = output;
    this.isWithScripts = isWithScripts;
    this.waitAsync = waitAsync;
  }

  public static isNetworkFailure(log: string): boolean {
    return RootInstall.ERROR_CODE_PATTERN.test(log) && RootInstall.NETWORK_PATTERN.test(log);
  }

  private static formatRetry(requests: readonly string[]): string {
    return `npm ci stopped on a read that stalled or a connection that was reset, which npm doesn't retry, so it runs once more in ${RootInstall.RETRY_PAUSE / 1000} seconds. Its last requests:\n${requests.map(t => `${t}\n`).join("")}`;
  }

  public async runAsync(): Promise<number> {
    if (!this.isWithScripts && existsSync(path.join(this.root, RootInstall.MODULES_FOLDER)))
      return RootInstall.SUCCESS_EXIT_CODE;
    const npm = this.environment[RootInstall.NPM_VARIABLE];
    if (npm === undefined || npm.length === 0) {
      this.output.write(this.isWithScripts ? RootInstall.UNAVAILABLE_WITH_SCRIPTS : RootInstall.UNAVAILABLE);
      return RootInstall.FAILED_EXIT_CODE;
    }
    if (!this.isWithScripts)
      this.output.write(RootInstall.INSTALLING);
    const first = await this.attemptAsync(npm);
    if (first.exitCode === RootInstall.SUCCESS_EXIT_CODE || !RootInstall.isNetworkFailure(first.log))
      return first.exitCode;
    this.output.write(RootInstall.formatRetry(first.log.split(RootInstall.LINE_PATTERN).filter(t => RootInstall.REQUEST_PATTERN.test(t)).slice(-RootInstall.REQUEST_LINES)));
    await this.waitAsync(RootInstall.RETRY_PAUSE);
    return (await this.attemptAsync(npm)).exitCode;
  }

  private async attemptAsync(npm: string): Promise<{ exitCode: number; log: string }> {
    const logs = mkdtempSync(path.join(tmpdir(), RootInstall.LOGS_PREFIX));
    try {
      const exitCode = await new Promise<number>((resolve, reject) => {
        const child = spawn(process.execPath, [npm, ...(this.isWithScripts ? RootInstall.WITH_SCRIPTS_ARGUMENTS : RootInstall.ARGUMENTS)], { cwd: this.root, shell: false, stdio: "inherit", env: { ...this.environment, [RootInstall.LOGS_VARIABLE]: logs } });
        child.once("error", reject);
        child.once("close", code => resolve(code ?? RootInstall.FAILED_EXIT_CODE));
      });
      return { exitCode, log: readdirSync(logs).sort().map(t => readFileSync(path.join(logs, t), "utf8")).join("\n") };
    }
    finally {
      rmSync(logs, { recursive: true, force: true });
    }
  }
}

if (import.meta.main)
  process.exitCode = await new RootInstall(process.cwd(), process.env, process.stdout, process.argv.includes(RootInstall.WITH_SCRIPTS_OPTION)).runAsync();
