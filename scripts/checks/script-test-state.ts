/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import FlakyTest from "./flaky-test.ts";

export default class ScriptTestState {
  public static readonly RUNNER: string = "Script tests";

  private static readonly NAME_SEPARATOR: string = " > ";
  private static readonly RESULT_LINE: RegExp = /^\s*(?:not )?ok \d+ - /;
  private static readonly FAILED_LINE: RegExp = /^(\s*)not ok \d+ - /;
  private static readonly LOCATION_LINE: RegExp = /^\s*location: '(.+):(\d+):(\d+)'$/;
  private static readonly DURATION_LINE: RegExp = /^\s*duration_ms: /;
  private static readonly YAML_END: string = "...";

  public static readTests(root: string, state: string, report: string): readonly FlakyTest[] {
    const attempts = ScriptTestState.parseJson(state);
    const last = Array.isArray(attempts) ? attempts.at(-1) : undefined;
    if (typeof last !== "object" || last === null)
      return [];
    const entries = Object.entries(last as Record<string, unknown>)
      .filter(([, t]) => typeof t === "object" && t !== null)
      .map(([key, t]) => [key.split(path.win32.sep).join(path.posix.sep), t]) as [string, Record<string, unknown>][];
    const parents = new Map<string, string>();
    for (const [key, entry] of entries)
      for (const child of Array.isArray(entry["children"]) ? entry["children"] as unknown[] : [])
        parents.set(ScriptTestState.keyOf(root, child), key);
    const names = new Map(entries.map(([key, entry]) => [key, String(entry["name"])]));
    const failures = ScriptTestState.readFailures(root, report);
    return entries
      .filter(([, entry]) => Array.isArray(entry["children"]) && entry["children"].length === 0 && typeof entry["passed_on_attempt"] === "number" && entry["passed_on_attempt"] > 0)
      .map(([key]) => new FlakyTest(ScriptTestState.RUNNER, key.replace(/:\d+:\d+$/, ""), ScriptTestState.nameOf(key, names, parents), failures.get(key) ?? ""));
  }

  private static parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    }
    catch {
      return null;
    }
  }

  private static keyOf(root: string, child: unknown): string {
    const fields = typeof child === "object" && child !== null ? child as Record<string, unknown> : {};
    return `${ScriptTestState.relative(root, String(fields["file"]))}:${String(fields["line"])}:${String(fields["column"])}`;
  }

  private static relative(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join(path.posix.sep);
  }

  private static nameOf(key: string, names: ReadonlyMap<string, string>, parents: ReadonlyMap<string, string>): string {
    const parts: string[] = [];
    for (let current: string | undefined = key; current !== undefined; current = parents.get(current))
      parts.unshift(String(names.get(current)));
    return parts.join(ScriptTestState.NAME_SEPARATOR);
  }

  private static readFailures(root: string, report: string): ReadonlyMap<string, string> {
    const failures = new Map<string, string>();
    let block: string[] | null = null;
    let indent = 0;
    const close = (): void => {
      const location = block?.map(t => ScriptTestState.LOCATION_LINE.exec(t)).find(t => t !== null);
      if (block !== null && location !== undefined)
        failures.set(`${ScriptTestState.relative(root, String(location[1]))}:${location[2]}:${location[3]}`, block.filter(t => !ScriptTestState.DURATION_LINE.test(t)).map(t => t.slice(indent)).join("\n"));
      block = null;
    };
    for (const line of report.split("\n")) {
      if (ScriptTestState.RESULT_LINE.test(line))
        close();
      const failed = ScriptTestState.FAILED_LINE.exec(line);
      if (failed !== null) {
        block = [];
        indent = String(failed[1]).length;
      }
      block?.push(line);
      if (line === `${" ".repeat(indent + 2)}${ScriptTestState.YAML_END}`)
        close();
    }
    close();
    return failures;
  }
}
