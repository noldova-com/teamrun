/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import JsonFields from "../../totals/json-fields.ts";
import TotalsException from "../../totals/totals.exception.ts";
import UiCheckpoint from "../../workflows/ui-checkpoint.ts";

class UiCheckpointTests {
  private static readonly SETTINGS: object = { theme: "shell.default", mode: "System", interfaceFont: "Noldova", codeFont: "System", panelSize: 13, messageSize: 14, codeSize: 14.5 };
  private static readonly HEADER: string = "| Workflow | Checkpoint | Theme | Mode | Fonts (interface / code) | Sizes (panel / message / code) | Zoom | Viewport | Pixel ratio |\n|---|---|---|---|---|---|---|---|---|\n";

  public static register(): void {
    test("each checkpoint of each result is read with its workflow's file, suites and title, and a retry's are marked as such", () => {
      const report = UiCheckpointTests.report([{
        title: "a.spec.ts",
        specs: [UiCheckpointTests.spec("opens", [UiCheckpointTests.result(0, [UiCheckpointTests.checkpoint("first"), { type: "platform-log", description: "line" }, UiCheckpointTests.checkpoint("second")])])],
        suites: [{
          title: "docks",
          specs: [UiCheckpointTests.spec("moves", [UiCheckpointTests.result(0, [UiCheckpointTests.checkpoint("moved")]), UiCheckpointTests.result(1, [UiCheckpointTests.checkpoint("moved")])])],
          suites: [{ title: "empty" }]
        }]
      }, { title: "b.spec.ts", specs: [UiCheckpointTests.spec("waits", [{ retry: 0 }])] }]);

      const checkpoints = UiCheckpoint.readAll(report, "report.json");

      assert.deepEqual(checkpoints.map(t => [t.workflow, t.name]), [
        ["a.spec.ts › opens", "first"],
        ["a.spec.ts › opens", "second"],
        ["a.spec.ts › docks › moves", "moved"],
        ["a.spec.ts › docks › moves (retry 1)", "moved"]
      ]);
      assert.deepEqual(checkpoints[0]?.settings, UiCheckpointTests.SETTINGS);
      assert.deepEqual([checkpoints[0]?.settingsProblem, checkpoints[0]?.colorScheme, checkpoints[0]?.zoom, checkpoints[0]?.width, checkpoints[0]?.height, checkpoints[0]?.pixelRatio], ["", "dark", 1.25, 1536, 864, 1.25]);
    });

    test("the section lists every checkpoint in a collapsed table, escaped, and names the settings it could not read", () => {
      const unread = { ...UiCheckpointTests.record("unread"), settings: null, settingsProblem: "shell.settings had no answer | within 5000 ms." };
      const report = UiCheckpointTests.report([{ title: "a.spec.ts", specs: [UiCheckpointTests.spec("<opens>", [UiCheckpointTests.result(0, [UiCheckpointTests.checkpoint("first"), { type: "checkpoint", description: JSON.stringify(unread) }])])] }]);

      const section = UiCheckpoint.formatSection(UiCheckpoint.readAll(report, "report.json"));

      assert.equal(section, `\n<details><summary>Screenshot checkpoints (2)</summary>\n\n${UiCheckpointTests.HEADER}` +
        "| a.spec.ts › &lt;opens&gt; | first | shell.default | System → dark | Noldova / System | 13 / 14 / 14.5 | 1.25 | 1536 × 864 | 1.25 |\n" +
        "| a.spec.ts › &lt;opens&gt; | unread | Not read: shell.settings had no answer &#124; within 5000 ms. | dark | Not read | Not read | 1.25 | 1536 × 864 | 1.25 |\n" +
        "\n</details>\n");
      assert.equal(UiCheckpoint.formatSection([]), "");
    });

    test("a checkpoint record that is not JSON or lacks a field is refused with its workflow", () => {
      const broken = (description: string): JsonFields => UiCheckpointTests.report([{ title: "a.spec.ts", specs: [UiCheckpointTests.spec("opens", [UiCheckpointTests.result(0, [{ type: "checkpoint", description }])])] }]);
      const { zoom, ...unzoomed } = UiCheckpointTests.record("first");

      assert.equal(zoom, 1.25);
      assert.throws(() => UiCheckpoint.readAll(broken("{"), "report.json"), new TotalsException("report.json, a.spec.ts › opens, checkpoint is not JSON."));
      assert.throws(() => UiCheckpoint.readAll(broken(JSON.stringify(unzoomed)), "report.json"), new TotalsException("report.json, a.spec.ts › opens, checkpoint has no number zoom."));
      assert.throws(() => UiCheckpoint.readAll(broken(JSON.stringify({ ...unzoomed, zoom: 1, settings: { ...UiCheckpointTests.SETTINGS, panelSize: "13" } })), "report.json"),
        new TotalsException("report.json, a.spec.ts › opens, checkpoint, settings, has no number panelSize."));
    });
  }

  private static record(name: string): Record<string, unknown> {
    return { name, settings: UiCheckpointTests.SETTINGS, colorScheme: "dark", zoom: 1.25, viewport: { width: 1536, height: 864 }, pixelRatio: 1.25 };
  }

  private static checkpoint(name: string): object {
    return { type: "checkpoint", description: JSON.stringify(UiCheckpointTests.record(name)) };
  }

  private static result(retry: number, annotations: readonly object[]): object {
    return { retry, annotations };
  }

  private static spec(title: string, results: readonly object[]): object {
    return { title, tests: [{ results }] };
  }

  private static report(suites: readonly object[]): JsonFields {
    return new JsonFields({ suites }, "report.json");
  }
}

UiCheckpointTests.register();
