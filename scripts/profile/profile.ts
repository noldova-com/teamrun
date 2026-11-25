/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/context.core";

import { ProcessRunner } from "../processes/process-runner.ts";
import { FirstLaunchRecord } from "./first-launch-record.ts";
import { LargeImageDetail } from "./large-image-detail.ts";
import { ProfileOptions } from "./profile-options.ts";
import { ProfileRecorder } from "./profile-recorder.ts";
import { ProfileScenarios } from "./profile-scenarios.ts";
import { ProfiledApp } from "./profiled-app.ts";

export class Profile {
  private static readonly USAGE: string = "Usage: npm run profile -- <label> [--seed [--pairs <count>]] [--scenarios <name>,...] [--node]\n"
    + "Run npm run install:app and npm run build:app first.\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly DATA_VARIABLE: string = "TEAMRUN_DATA_DIR";
  private static readonly DATA_FOLDER: readonly string[] = ["app", "_build", "data"];
  private static readonly DEVICE_FOLDER: readonly string[] = ["app", "_build", "device"];
  private static readonly OUTPUT_FOLDER: readonly string[] = ["_build", "profile"];
  private static readonly MAIN: readonly string[] = ["app", "node_modules", "@noldova", "desktop.electron", "main.js"];
  private static readonly SEED_SCRIPT: readonly string[] = ["app", "seed-stress.ts"];
  private static readonly PAIRS_OPTION: string = "--pairs";
  private static readonly NODE_FOLDER: string = "node";
  private static readonly IMAGE_SCENARIOS: ReadonlySet<string> = new Set(["open-image", "open-written-image-again"]);
  private static readonly SETTLE: number = 1000;

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable) {
    this.root = root;
    this.runner = runner;
    this.environment = environment;
    this.output = output;
  }

  public async runAsync(args: readonly string[]): Promise<number> {
    const options = ProfileOptions.parse(args);
    if (Object.isNull(options))
      return this.usage();
    if (!existsSync(path.join(this.root, ...Profile.MAIN))) {
      this.output.write(`The app isn't installed and built in app/; run npm run install:app and npm run build:app first.\n`);
      return 1;
    }
    const folder = path.join(this.root, ...Profile.OUTPUT_FOLDER, options.label);
    const data = this.environment[Profile.DATA_VARIABLE] ?? path.join(this.root, ...Profile.DATA_FOLDER);
    mkdirSync(folder, { recursive: true });

    if (options.seed) {
      const seeded = await this.runner.runAsync(process.execPath, [path.join(this.root, ...Profile.SEED_SCRIPT), ...Object.isNull(options.pairs) ? [] : [Profile.PAIRS_OPTION, options.pairs]],
        path.join(this.root, "app"), { ...this.environment, [Profile.DATA_VARIABLE]: data });
      if (seeded !== 0)
        return seeded ?? 1;
      this.log(`added a large generated image to ${LargeImageDetail.add(data)}`);
    }

    const welcome = FirstLaunchRecord.isPending(data);
    this.log(welcome ? "the first launch is pending, so the app shows its welcome" : "the first launch is finished, so the app shows no welcome");
    const nodeProfiles = options.profileNode ? path.join(folder, Profile.NODE_FOLDER) : null;
    const app = await ProfiledApp.startAsync(this.root, data, path.join(this.root, ...Profile.DEVICE_FOLDER), nodeProfiles, t => this.log(t));
    let recorder: ProfileRecorder;
    let failed: string | null = null;
    try {
      await app.skipWelcomeAsync(welcome);
      await delay(Profile.SETTLE);
      recorder = await ProfileRecorder.startAsync(app.page, app.frame, folder, this.root, t => this.log(t));
      const scenarios = new ProfileScenarios(app.page, app.frame, t => this.log(t));
      const unknown = (options.scenarios ?? []).filter(t => !scenarios.names.includes(t));
      if (unknown.length > 0) {
        this.output.write(`No scenario ${unknown.join(", ")}; the scenarios are ${scenarios.names.join(", ")}.\n`);
        return Profile.USAGE_EXIT_CODE;
      }
      for (const name of scenarios.names.filter(t => Object.isNull(options.scenarios) || options.scenarios.includes(t))) {
        if (!Object.isNull(failed))
          recorder.skip(name, failed);
        else if (!await Profile.runScenarioAsync(recorder, scenarios, name))
          failed = name;
      }
      await app.page.screenshot({ path: path.join(folder, "end.png") }).catch(() => undefined);
      await recorder.saveSourcesAsync();
    }
    finally {
      await app.stopAsync();
    }
    if (!Object.isNull(nodeProfiles))
      recorder.summarizeNodeProfiles(nodeProfiles);
    this.log(`RESULTS ${options.label}, in ${path.relative(this.root, folder)}`);
    for (const line of recorder.results)
      this.log(`  ${line}`);
    return Object.isNull(failed) ? 0 : 1;
  }

  private static async runScenarioAsync(recorder: ProfileRecorder, scenarios: ProfileScenarios, name: string): Promise<boolean> {
    if (Profile.IMAGE_SCENARIOS.has(name)) {
      try {
        await scenarios.revealImageAsync();
      }
      catch (error) {
        await recorder.failAsync(name, error);
        return false;
      }
    }
    return await recorder.recordAsync(name, scenarios.workOf(name));
  }

  private log(text: string): void {
    this.output.write(`[${new Date().toISOString().slice(11, 19)}] ${text}\n`);
  }

  private usage(): number {
    this.output.write(Profile.USAGE);
    return Profile.USAGE_EXIT_CODE;
  }
}

if (import.meta.main)
  process.exitCode = await new Profile(process.cwd(), new ProcessRunner(), process.env, process.stdout).runAsync(process.argv.slice(2));
