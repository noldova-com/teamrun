/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

import "@noldova/teamrun-foundation-core";
import type { IProcessTracker } from "@noldova/teamrun-providers";

import { TrackedProcess } from "../../models/tracked-process.js";
import { Resources } from "../../resources.js";
import type { ProcessProbe } from "../lock/process-probe.js";
import type { ProcessInspector } from "./process-inspector.js";

export class ProcessRegistry implements IProcessTracker {
  private readonly path: string;
  private readonly runtimeProcessId: number;
  private readonly probe: ProcessProbe;
  private readonly inspector: ProcessInspector;

  public constructor(path: string, runtimeProcessId: number, probe: ProcessProbe, inspector: ProcessInspector) {
    this.path = path;
    this.runtimeProcessId = runtimeProcessId;
    this.probe = probe;
    this.inspector = inspector;
  }

  public track(processId: number, executable: string): void {
    if (processId === Resources.unknownProcessId)
      return;
    this.write([...this.read(), new TrackedProcess(processId, executable, this.runtimeProcessId)]);
  }

  public untrack(processId: number): void {
    this.write(this.read().filter(t => t.processId !== processId));
  }

  public reapLeftovers(): readonly number[] {
    const kept: TrackedProcess[] = [];
    const ended: number[] = [];
    for (const entry of this.read()) {
      if (this.probe.isAlive(entry.runtimeProcessId)) {
        kept.push(entry);
        continue;
      }
      if (this.probe.isAlive(entry.processId) && this.isRecordedImage(entry) && this.end(entry.processId))
        ended.push(entry.processId);
    }
    this.write(kept);

    return ended;
  }

  private isRecordedImage(entry: TrackedProcess): boolean {
    const image = this.inspector.imageOf(entry.processId);
    return !Object.isNull(image) && image.toLowerCase() === basename(entry.executable).toLowerCase();
  }

  private end(processId: number): boolean {
    try {
      process.kill(processId);
      return true;
    }
    catch {
      return false;
    }
  }

  private read(): TrackedProcess[] {
    let text: string;
    try {
      text = readFileSync(this.path, Resources.utf8Encoding);
    }
    catch {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(text);
      return Array.isArray(parsed) ? parsed.map(t => TrackedProcess.fromJson(t)).filter(t => !Object.isNull(t)) : [];
    }
    catch {
      return [];
    }
  }

  private write(entries: readonly TrackedProcess[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(entries.map(t => t.toJson())), Resources.utf8Encoding);
  }
}
