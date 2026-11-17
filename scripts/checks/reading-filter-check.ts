/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Writable } from "node:stream";

import type { ICheck } from "./interfaces/i-check.ts";
import type { ISelectableCheck } from "./interfaces/i-selectable-check.ts";
import { ReadingChecks } from "./reading-checks.ts";

export class ReadingFilterCheck implements ICheck {
  private static readonly TITLES: readonly string[] = ["Concept files", "Concept folders", "Bucket names"];
  private static readonly FAILING: string = "Concept folders";
  private static readonly CASES: readonly { filters: readonly string[]; ran: readonly string[]; isPassing: boolean }[] = [
    { filters: ["Concept"], ran: ["Concept files", "Concept folders"], isPassing: false },
    { filters: ["Bucket", "files"], ran: ["Concept files", "Bucket names"], isPassing: true },
    { filters: ["concept"], ran: [], isPassing: true }
  ];

  private readonly createStagesAsync: () => Promise<readonly (readonly ICheck[])[]>;
  private readonly createSelectablesAsync: () => Promise<readonly ISelectableCheck[]>;

  public readonly title: string = "Reading check filters";

  public constructor(createStagesAsync: () => Promise<readonly (readonly ICheck[])[]>, createSelectablesAsync: () => Promise<readonly ISelectableCheck[]>) {
    this.createStagesAsync = createStagesAsync;
    this.createSelectablesAsync = createSelectablesAsync;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const wiring = await this.findWiringAsync();
    if (wiring !== null)
      output.write(`A filtered run of npm test: ${wiring}\n`);
    let passed = wiring === null;
    for (const expected of ReadingFilterCheck.CASES) {
      const finding = await ReadingFilterCheck.findAsync(expected);
      if (finding !== null)
        output.write(`A filtered run of ${expected.filters.map(t => JSON.stringify(t)).join(", ")}: ${finding}\n`);
      passed &&= finding === null;
    }
    output.write(`Selected checks that read by title in ${ReadingFilterCheck.CASES.length} filtered runs.\n`);
    return passed;
  }

  private async findWiringAsync(): Promise<string | null> {
    const [reading] = await this.createStagesAsync();
    const [first] = await this.createSelectablesAsync();
    const expected = JSON.stringify(reading?.map(t => t.title) ?? []);
    if (!(first instanceof ReadingChecks))
      return `its first check is ${first?.title ?? "missing"}; it should be the checks that read, ${expected}.`;
    const found = JSON.stringify(first.titles);
    return found === expected ? null : `it selects from ${found}; it should select from the full run's checks that read, ${expected}.`;
  }

  private static async findAsync(expected: { filters: readonly string[]; ran: readonly string[]; isPassing: boolean }): Promise<string | null> {
    const ran: string[] = [];
    const checks: ICheck[] = ReadingFilterCheck.TITLES.map(t => ({ title: t, runAsync: () => { ran.push(t); return Promise.resolve(t !== ReadingFilterCheck.FAILING); } }));
    const discard = new Writable({ write: (_chunk, _encoding, done) => done() });
    const selection = await new ReadingChecks(checks).runSelectedAsync(expected.filters, discard);
    const found = `ran ${JSON.stringify(ran)}, ${selection.selected} of ${selection.discovered} ${selection.unit} selected, ${selection.isPassing ? "passing" : "failing"}`;
    const isExpected = JSON.stringify(ran) === JSON.stringify(expected.ran) && selection.selected === expected.ran.length && selection.discovered === checks.length
      && selection.isPassing === expected.isPassing;
    return isExpected ? null : `${found}; it should run ${JSON.stringify(expected.ran)}, and be ${expected.isPassing ? "passing" : "failing"}.`;
  }
}
