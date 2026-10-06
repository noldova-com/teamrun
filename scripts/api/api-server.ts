/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessByStdio, spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import type { Readable } from "node:stream";

import { API, type Project } from "typescript/unstable/async";

import TemporaryFolder from "../processes/temporary-folder.ts";
import ApiPipe from "./api-pipe.ts";
import ApiException from "./api.exception.ts";

export default class ApiServer {
  private static readonly COMPILER_PACKAGE: string = "@typescript/typescript";
  private static readonly COMPILER_MANIFEST: string = "package.json";
  private static readonly COMPILER_FOLDER: string = "lib";
  private static readonly COMPILER_NAME: string = "tsc";
  private static readonly WINDOWS_PLATFORM: string = "win32";
  private static readonly WINDOWS_EXTENSION: string = ".exe";
  private static readonly SERVER_ARGUMENTS: readonly string[] = ["--api", "--async", "--cwd"];
  private static readonly PIPE_OPTION: string = "--pipe";
  private static readonly CONNECTION_FAILURE: string = "Socket error:";
  private static readonly CONNECT_INTERVAL: number = 20;
  private static readonly START_TIMEOUT: number = 60_000;
  private static readonly ERROR_OUTPUT_LIMIT: number = 4096;

  private readonly child: ChildProcessByStdio<null, null, Readable>;
  private readonly exited: Promise<void>;
  private readonly api: API;
  private readonly pipe: ApiPipe;

  public readonly project: Project;

  private constructor(child: ChildProcessByStdio<null, null, Readable>, exited: Promise<void>, api: API, pipe: ApiPipe, project: Project) {
    this.child = child;
    this.exited = exited;
    this.api = api;
    this.pipe = pipe;
    this.project = project;
  }

  public static locateCompiler(platform: string = process.platform, architecture: string = process.arch): string {
    const manifest = createRequire(import.meta.url)
      .resolve(`${ApiServer.COMPILER_PACKAGE}-${platform}-${architecture}/${ApiServer.COMPILER_MANIFEST}`);
    return path.join(path.dirname(manifest), ApiServer.COMPILER_FOLDER, ApiServer.formatCompilerName(platform));
  }

  public static formatCompilerName(platform: string): string {
    return platform === ApiServer.WINDOWS_PLATFORM ? `${ApiServer.COMPILER_NAME}${ApiServer.WINDOWS_EXTENSION}` : ApiServer.COMPILER_NAME;
  }

  public static async useAsync<T>(
    command: readonly string[],
    root: string,
    projectFile: string,
    timeout: number,
    work: (project: Project) => Promise<T>): Promise<T> {
    const server = await ApiServer.startAsync(command, root, projectFile);
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ApiException(`The TypeScript API did not finish within ${timeout} ms.`)), timeout);
    });
    const running = work(server.project);
    running.catch(() => undefined);
    try {
      return await Promise.race([running, deadline]);
    }
    finally {
      clearTimeout(timer);
      await server.closeAsync();
    }
  }

  private static async startAsync(command: readonly string[], root: string, projectFile: string): Promise<ApiServer> {
    const [executable, ...prefix] = command;
    if (executable === undefined)
      throw new ApiException("The TypeScript API needs a command to start its server.");
    const pipe = await ApiPipe.createAsync(process.platform, new TemporaryFolder());
    const child = spawn(executable, [...prefix, ...ApiServer.SERVER_ARGUMENTS, root, ApiServer.PIPE_OPTION, pipe.name], {
      cwd: root, shell: false, stdio: ["ignore", "ignore", "pipe"], windowsHide: true
    });
    let errorOutput = "";
    let hasExited = false;
    child.stderr.on("data", (t: Buffer) => {
      errorOutput = `${errorOutput}${t.toString("utf8")}`.slice(-ApiServer.ERROR_OUTPUT_LIMIT);
    });
    const exited = new Promise<void>(resolve => {
      const finish = (): void => {
        hasExited = true;
        resolve();
      };
      child.once("error", finish);
      child.once("close", finish);
    });
    const started = Date.now();
    for (;;) {
      const api = new API({ pipe: pipe.name });
      try {
        const [project] = (await api.updateSnapshot({ openProject: projectFile })).getProjects();
        if (project === undefined)
          throw new ApiException(`The TypeScript API found no project in ${projectFile}.`);
        return new ApiServer(child, exited, api, pipe, project);
      }
      catch (error) {
        const outputBeforeClosing = errorOutput;
        const hasStopped = hasExited;
        await api.close();
        const isConnectionFailure = error instanceof Error && error.message.startsWith(ApiServer.CONNECTION_FAILURE);
        const elapsed = Date.now() - started;
        if (!isConnectionFailure || hasStopped || elapsed >= ApiServer.START_TIMEOUT) {
          child.kill();
          await exited;
          await pipe.removeAsync();
          throw new ApiException(ApiServer.describeFailure(projectFile, elapsed, hasStopped, outputBeforeClosing),
            { cause: error });
        }
      }
      await new Promise(resolve => setTimeout(resolve, ApiServer.CONNECT_INTERVAL));
    }
  }

  public static describeFailure(projectFile: string, elapsed: number, hasStopped: boolean, serverOutput: string): string {
    const state = hasStopped ? "had stopped" : "was running";
    const detail = serverOutput.trim();
    return `The TypeScript API server could not open ${projectFile}; after ${elapsed} ms it ${state}.${detail === "" ? "" : `\n${detail}`}`;
  }

  private async closeAsync(): Promise<void> {
    await this.api.close();
    this.child.kill();
    await this.exited;
    await this.pipe.removeAsync();
  }
}
