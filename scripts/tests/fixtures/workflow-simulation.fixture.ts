/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

export interface SimulatedStep {
  readonly name: string;
  readonly id: string | null;
  readonly condition: string | null;
  readonly continueOnError: boolean;
  readonly uses: string | null;
  readonly settings: readonly string[];
}

export default class WorkflowSimulation {
  private static readonly STEP_PATTERN: RegExp = /^( *)- name: (.+)$/;
  private static readonly KEY_PATTERN: RegExp = /^([a-z-]+):(?: (.*))?$/;
  private static readonly OUTCOME_PATTERN: RegExp = /^steps\.([a-z-]+)\.outcome (==|!=) '([a-z]+)'$/;
  private static readonly MATRIX_PATTERN: RegExp = /^matrix\.([a-z]+) (==|!=) '([a-z]+)'$/;
  private static readonly MATRIX_FLAG_PATTERN: RegExp = /^matrix\.([a-z]+)$/;
  private static readonly ALWAYS: string = "always()";
  private static readonly FAILURE: string = "failure()";
  private static readonly SKIPPED: string = "skipped";

  public readonly steps: readonly SimulatedStep[];

  public constructor(workflow: string, firstStep: string, lastStep: string) {
    const lines = workflow.split("\n");
    const starts = lines.flatMap((line, index) => WorkflowSimulation.STEP_PATTERN.test(line) ? [index] : []);
    const all = starts.map((start, index) => WorkflowSimulation.parse(lines.slice(start, starts[index + 1] ?? lines.length)));
    const first = all.findIndex(t => t.name === firstStep);
    const last = all.findIndex(t => t.name === lastStep);
    assert.ok(first >= 0 && last > first, `The steps "${firstStep}" to "${lastStep}" were not found.`);
    this.steps = all.slice(first, last + 1);
  }

  public find(name: string): SimulatedStep {
    const step = this.steps.find(t => t.name === name);
    assert.ok(step !== undefined, `No step named "${name}".`);
    return step;
  }

  public run(matrix: Readonly<Record<string, string>>, outcomes: Readonly<Record<string, string>>): { readonly ran: readonly string[]; readonly isJobFailed: boolean } {
    const results = new Map<string, string>();
    const ran: string[] = [];
    let isJobFailed = false;
    for (const step of this.steps) {
      const terms = step.condition?.split(" && ") ?? [];
      const isRun = (terms.includes(WorkflowSimulation.FAILURE) ? isJobFailed : terms.includes(WorkflowSimulation.ALWAYS) || !isJobFailed) && this.evaluate(terms, matrix, results);
      const outcome = isRun ? outcomes[step.name] ?? "success" : WorkflowSimulation.SKIPPED;
      if (step.id !== null)
        results.set(step.id, outcome);
      if (!isRun)
        continue;
      ran.push(step.name);
      if (outcome === "failure" && !step.continueOnError)
        isJobFailed = true;
    }
    return { ran, isJobFailed };
  }

  private evaluate(terms: readonly string[], matrix: Readonly<Record<string, string>>, results: ReadonlyMap<string, string>): boolean {
    return terms.every(term => {
      if (term === WorkflowSimulation.ALWAYS || term === WorkflowSimulation.FAILURE)
        return true;
      const setting = WorkflowSimulation.MATRIX_PATTERN.exec(term);
      if (setting !== null) {
        const value = WorkflowSimulation.readMatrix(matrix, setting[1] ?? "");
        return setting[2] === "==" ? value === setting[3] : value !== setting[3];
      }
      const flag = WorkflowSimulation.MATRIX_FLAG_PATTERN.exec(term);
      if (flag !== null)
        return WorkflowSimulation.readMatrix(matrix, flag[1] ?? "") === "true";
      const match = WorkflowSimulation.OUTCOME_PATTERN.exec(term);
      assert.ok(match !== null, `Unsupported condition term "${term}".`);
      const outcome = results.get(match[1] ?? "") ?? WorkflowSimulation.SKIPPED;
      return match[2] === "==" ? outcome === match[3] : outcome !== match[3];
    });
  }

  private static readMatrix(matrix: Readonly<Record<string, string>>, name: string): string {
    const value = matrix[name];
    assert.ok(value !== undefined, `The simulated leg has no matrix value "${name}".`);
    return value;
  }

  private static parse(lines: readonly string[]): SimulatedStep {
    const step = WorkflowSimulation.STEP_PATTERN.exec(lines[0] ?? "");
    const keyIndentation = " ".repeat((step?.[1]?.length ?? 0) + 2);
    const settingIndentation = `${keyIndentation}  `;
    const keys = new Map<string, string>();
    const settings: string[] = [];
    let isWith = false;
    for (const line of lines.slice(1)) {
      const key = line.startsWith(keyIndentation) && line[keyIndentation.length] !== " " ? WorkflowSimulation.KEY_PATTERN.exec(line.slice(keyIndentation.length)) : null;
      if (key !== null) {
        isWith = key[1] === "with";
        keys.set(key[1] ?? "", key[2] ?? "");
        continue;
      }
      if (isWith && line.startsWith(settingIndentation))
        settings.push(line.slice(settingIndentation.length));
    }
    return {
      name: step?.[2] ?? "",
      id: keys.get("id") ?? null,
      condition: keys.get("if") ?? null,
      continueOnError: keys.get("continue-on-error") === "true",
      uses: keys.get("uses") ?? null,
      settings
    };
  }
}
