/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import TestMirror from "../structure/test-mirror.ts";

export default class RepeatSelection {
  private static readonly FILTER_OPTION: string = "--filter";
  private static readonly SCRIPT_TESTS: string = "scripts/tests/";
  private static readonly SCRIPT_EXTENSION: string = ".ts";

  public readonly tests: readonly string[];
  public readonly workflows: readonly string[];

  public constructor(tests: readonly string[], workflows: readonly string[]) {
    this.tests = [...tests].sort();
    this.workflows = [...workflows].sort();
  }

  public get isEmpty(): boolean {
    return this.tests.length === 0 && this.workflows.length === 0;
  }

  public get testArguments(): readonly string[] {
    return this.tests.flatMap(t => [RepeatSelection.FILTER_OPTION, RepeatSelection.toFilter(t)]);
  }

  public get summary(): string {
    if (this.isEmpty)
      return "No test or UI workflow file is affected by the change, so nothing is repeated.";
    const list = (title: string, paths: readonly string[]): string => paths.length === 0 ? "" : `${title}:\n${paths.map(t => `- ${t}\n`).join("")}`;
    return `${list("Repeated test files", this.tests)}${list("Repeated UI workflow files", this.workflows)}`.trimEnd();
  }

  private static toFilter(test: string): string {
    if (test.startsWith(RepeatSelection.SCRIPT_TESTS))
      return test;
    const folder = test.slice(0, test.indexOf(`/${TestMirror.TESTS_FOLDER}/`));
    if (TestMirror.isAngularPackage(folder))
      return test.slice(`${TestMirror.SOURCE_FOLDER}/`.length);
    return test.slice(`${folder}/${TestMirror.TESTS_FOLDER}/`.length, -RepeatSelection.SCRIPT_EXTENSION.length);
  }
}
