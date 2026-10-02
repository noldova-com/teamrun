/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "@playwright/test";

import ErrorOutputClassifier from "./fixtures/error-output.classifier.ts";

test.describe("the harness's reading of the main process's error output", () => {
  const warning = "(electron:226035): Gtk-WARNING **: 21:13:15.015: Could not load a pixbuf from icon theme.";
  const continuation = "This may indicate that pixbuf loaders or the mime database could not be found.";

  test("a GTK warning with its continuation line is a platform log, even when the lines arrive apart", () => {
    const together = new ErrorOutputClassifier().classify(`${warning}\n${continuation}\n`);
    const classifier = new ErrorOutputClassifier();
    const apart = [...classifier.classify(`${warning}\n`), ...classifier.classify(`${continuation}\n`)];

    expect(together).toEqual([{ kind: "platform-log", text: warning }, { kind: "platform-log", text: continuation }]);
    expect(apart).toEqual(together);
  });

  test("a macOS service line is a platform log and Chromium's own lines are expected", () => {
    const service = "2026-10-02 03:20:40.123 Electron Helper (Renderer)[1234:5678] XPC connection interrupted";

    expect(new ErrorOutputClassifier().classify(`[1:0102/030405.678:ERROR:thing] x\nDebugger listening on ws://127.0.0.1:1/x\nFor help, see: y\n${service}\n`))
      .toEqual([{ kind: "platform-log", text: service }]);
  });

  test("Node's debugger lines are expected, including the wait for the debugger to disconnect as the process exits", () => {
    expect(new ErrorOutputClassifier().classify("Debugger attached.\nWaiting for the debugger to disconnect...\nDebugger ending on ws://127.0.0.1:1/x\n")).toEqual([]);
  });

  test("any other output still fails, including GTK's continuation text without a GTK warning before it", () => {
    const classifier = new ErrorOutputClassifier();

    expect(classifier.classify("Error: boom\n")).toEqual([{ kind: "failure", text: "Error: boom" }]);
    expect(classifier.classify(`${continuation}\n`)).toEqual([{ kind: "failure", text: continuation }]);
    expect(classifier.classify(`${warning}\nError: boom\n(electron:1): Gtk-CRITICAL **: broken\n${continuation}\n`).map(t => t.kind))
      .toEqual(["platform-log", "failure", "failure", "failure"]);
  });
});
