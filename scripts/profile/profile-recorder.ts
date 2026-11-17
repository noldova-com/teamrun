/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { CDPSession, Frame, Page } from "playwright";

import { CpuProfile } from "./cpu-profile.ts";
import { FrameStatistics } from "./frame-statistics.ts";
import type { IPagePerformance } from "./interfaces/i-page-performance.ts";
import type { ProfileNode } from "./profile.node.ts";
import { ProfileSources } from "./profile-sources.ts";

export class ProfileRecorder {
  private static readonly SAMPLING_MICROSECONDS: number = 200;
  private static readonly TOP_SCRIPTS: number = 8;
  private static readonly ERROR_LENGTH: number = 400;
  private static readonly TOP_SELF: number = 12;
  private static readonly TOP_TOTAL: number = 15;
  private static readonly APP_CODE: RegExp = /src\/app|teamrun|ui\.components\.angular|desktop-window/;
  private static readonly NOT_CODE: RegExp = /^\((idle|program|garbage collector|root)\)/;
  private static readonly SCRIPT_FILE: RegExp = /\.m?js$/;
  private static readonly SOURCE_PREFIX: RegExp = /^.*?(src\/|node_modules\/)/;

  public readonly results: string[] = [];
  private readonly page: Page;
  private readonly frame: Frame;
  private readonly cdp: CDPSession;
  private readonly folder: string;
  private readonly windowBuild: string;
  private readonly fromSrc: NodeJS.Require;
  private readonly log: (text: string) => void;
  private readonly scriptUrls: Map<string, string> = new Map();
  private readonly maps: Map<string, { originalPositionFor(position: { line: number; column: number }): { source: string | null; line: number | null; name: string | null } } | null> = new Map();

  private constructor(page: Page, frame: Frame, cdp: CDPSession, folder: string, root: string, log: (text: string) => void) {
    this.page = page;
    this.frame = frame;
    this.cdp = cdp;
    this.folder = folder;
    this.windowBuild = path.join(root, "app", "_build", "window");
    this.fromSrc = createRequire(path.join(root, "src", "package.json"));
    this.log = log;
  }

  public static async startAsync(page: Page, frame: Frame, folder: string, root: string, log: (text: string) => void): Promise<ProfileRecorder> {
    await frame.evaluate(() => {
      const w = window as unknown as { __perf: IPagePerformance };
      w.__perf = { loaf: [], events: [], keys: [], frames: [], sampling: false };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries() as unknown as { duration: number; blockingDuration: number; scripts?: { invoker: string; sourceFunctionName: string; sourceURL: string; sourceCharPosition: number; duration: number }[] }[])
          w.__perf.loaf.push({ duration: entry.duration, blocking: entry.blockingDuration,
            scripts: (entry.scripts ?? []).map(t => ({ invoker: t.invoker, fn: t.sourceFunctionName, url: t.sourceURL, pos: t.sourceCharPosition, duration: t.duration })) });
      }).observe({ type: "long-animation-frame", buffered: false });
      new PerformanceObserver(list => {
        for (const entry of list.getEntries())
          w.__perf.events.push({ duration: entry.duration });
      }).observe({ type: "event", durationThreshold: 16, buffered: false } as PerformanceObserverInit);
      document.addEventListener("keydown", event => {
        const start = event.timeStamp;
        requestAnimationFrame(() => setTimeout(() => w.__perf.keys.push(performance.now() - start), 0));
      }, true);
      let last = 0;
      const loop = (now: number): void => {
        if (w.__perf.sampling && last > 0)
          w.__perf.frames.push(now - last);
        last = now;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: ProfileRecorder.SAMPLING_MICROSECONDS });
    return new ProfileRecorder(page, frame, cdp, folder, root, log);
  }

  public async recordAsync(name: string, work: () => Promise<void>): Promise<boolean> {
    await this.frame.evaluate(() => {
      const perf = (window as unknown as { __perf: IPagePerformance }).__perf;
      Object.assign(perf, { loaf: [], events: [], keys: [], frames: [], sampling: true });
    });
    await this.cdp.send("Profiler.start");
    const started = Date.now();
    try {
      await work();
    }
    catch (error) {
      await this.cdp.send("Profiler.stop").catch(() => undefined);
      await this.stopSamplingAsync().catch(() => undefined);
      await this.failAsync(name, error);
      return false;
    }
    const elapsed = Date.now() - started;
    const { profile } = await this.cdp.send("Profiler.stop");
    const perf = await this.stopSamplingAsync();
    const text = JSON.stringify(profile);
    writeFileSync(path.join(this.folder, `${name}.cpuprofile`), text);
    for (const node of profile.nodes)
      if (node.callFrame.url.length > 0)
        this.scriptUrls.set(node.callFrame.scriptId, node.callFrame.url);
    const loafTotal = perf.loaf.reduce((sum, t) => sum + t.duration, 0);
    const blocking = perf.loaf.reduce((sum, t) => sum + t.blocking, 0);
    this.report(`${name}: ${elapsed} ms; keys ${FrameStatistics.format(perf.keys)}; frames ${FrameStatistics.format(perf.frames)}; `
      + `events>=16 ${perf.events.length} (${FrameStatistics.format(perf.events.map(t => t.duration))}); loaf ${perf.loaf.length} total=${loafTotal.toFixed(0)} blocking=${blocking.toFixed(0)}`);
    const scripts = new Map<string, number>();
    for (const frame of perf.loaf)
      for (const script of frame.scripts) {
        const key = `${script.invoker} | ${script.fn} | ${String(script.url).split("/").pop()}:${script.pos}`;
        scripts.set(key, (scripts.get(key) ?? 0) + script.duration);
      }
    for (const [key, milliseconds] of [...scripts].sort((a, b) => b[1] - a[1]).slice(0, ProfileRecorder.TOP_SCRIPTS))
      this.log(`  loaf script ${milliseconds.toFixed(0)} ms: ${key}`);
    this.summarize(CpuProfile.parse(text), name);
    return true;
  }

  public async failAsync(name: string, error: unknown): Promise<void> {
    await this.page.screenshot({ path: path.join(this.folder, `${name}-failed.png`) }).catch(() => undefined);
    this.report(`${name}: FAILED, ${String(error).slice(0, ProfileRecorder.ERROR_LENGTH)}`);
  }

  public skip(name: string, failed: string): void {
    this.report(`${name}: SKIPPED, since ${failed} failed`);
  }

  public async saveSourcesAsync(): Promise<void> {
    await this.cdp.send("Debugger.enable").catch(() => undefined);
    const folder = path.join(this.folder, ProfileSources.FOLDER);
    mkdirSync(folder, { recursive: true });
    for (const [scriptId, url] of this.scriptUrls) {
      const name = url.split("/").pop()?.split("?")[0] ?? "";
      if (!ProfileRecorder.SCRIPT_FILE.test(name))
        continue;
      const source = await this.cdp.send("Debugger.getScriptSource", { scriptId }).catch(() => null);
      if (source !== null)
        writeFileSync(path.join(folder, name), source.scriptSource);
    }
  }

  public summarize(profile: CpuProfile, name: string): void {
    const self = new Map<string, number>();
    const total = new Map<string, number>();
    for (const [node, milliseconds] of profile.sampledNodes) {
      const key = this.nameOf(node);
      self.set(key, (self.get(key) ?? 0) + milliseconds);
      for (const at of new Set([key, ...profile.callersOf(node.id, Number.POSITIVE_INFINITY).map(t => this.nameOf(t))]))
        total.set(at, (total.get(at) ?? 0) + milliseconds);
    }
    this.log(`  ${name} top self:`);
    for (const [key, milliseconds] of [...self].filter(t => !ProfileRecorder.NOT_CODE.test(t[0])).sort((a, b) => b[1] - a[1]).slice(0, ProfileRecorder.TOP_SELF))
      this.log(`    ${milliseconds.toFixed(0)} ms  ${key}`);
    this.log(`  ${name} top total (app code):`);
    for (const [key, milliseconds] of [...total].filter(t => ProfileRecorder.APP_CODE.test(t[0])).sort((a, b) => b[1] - a[1]).slice(0, ProfileRecorder.TOP_TOTAL))
      this.log(`    ${milliseconds.toFixed(0)} ms  ${key}`);
    this.log(`    busy ${profile.busyMilliseconds.toFixed(0)} ms of ${profile.spanMilliseconds.toFixed(0)} ms`);
  }

  public summarizeNodeProfiles(folder: string): void {
    for (const file of existsSync(folder) ? readdirSync(folder) : [])
      this.summarize(CpuProfile.parse(readFileSync(path.join(folder, file), "utf8")), `node:${file}`);
  }

  private report(line: string): void {
    this.results.push(line);
    this.log(line);
  }

  private stopSamplingAsync(): Promise<Pick<IPagePerformance, "loaf" | "events" | "keys" | "frames">> {
    return this.frame.evaluate(() => {
      const perf = (window as unknown as { __perf: IPagePerformance }).__perf;
      perf.sampling = false;
      return { loaf: perf.loaf, events: perf.events, keys: perf.keys, frames: perf.frames };
    });
  }

  private nameOf(node: ProfileNode): string {
    const map = node.url.length > 0 ? this.mapOf(node.fileName) : null;
    const original = map?.originalPositionFor({ line: node.lineNumber + 1, column: node.columnNumber });
    if (original !== undefined && original.source !== null)
      return `${original.name ?? (node.functionName || "(anonymous)")} ${original.source.replace(ProfileRecorder.SOURCE_PREFIX, "$1")}:${original.line}`;
    return node.label;
  }

  private mapOf(fileName: string): ReturnType<ProfileRecorder["maps"]["get"]> {
    if (fileName.length === 0)
      return null;
    if (!this.maps.has(fileName)) {
      const file = ProfileRecorder.find(this.windowBuild, `${fileName}.map`);
      let map = null;
      try {
        const { SourceMapConsumer } = this.fromSrc("source-map-js") as { SourceMapConsumer: new (map: unknown) => NonNullable<ReturnType<ProfileRecorder["maps"]["get"]>> };
        map = file === null ? null : new SourceMapConsumer(JSON.parse(readFileSync(file, "utf8")));
      }
      catch (error) {
        this.log(`map failed ${fileName}: ${String(error).slice(0, 200)}`);
      }
      this.maps.set(fileName, map);
    }
    return this.maps.get(fileName) ?? null;
  }

  private static find(folder: string, name: string): string | null {
    for (const entry of existsSync(folder) ? readdirSync(folder, { withFileTypes: true }) : []) {
      const full = path.join(folder, entry.name);
      const found = entry.isDirectory() ? ProfileRecorder.find(full, name) : entry.name === name ? full : null;
      if (found !== null)
        return found;
    }
    return null;
  }
}
