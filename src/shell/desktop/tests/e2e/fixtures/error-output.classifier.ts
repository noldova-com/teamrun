/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export type OutputKind = "expected" | "platform-log" | "failure";

export interface ClassifiedLine {
  readonly kind: OutputKind;
  readonly text: string;
}

export default class ErrorOutputClassifier {
  private static readonly EXPECTED: readonly RegExp[] = [/^\[\d+:\d+(?:\/\d+)?\.\d+:\w+:/, /^Debugger (?:listening|attached|ending)/, /^Waiting for the debugger to disconnect/, /^For help, see/];
  private static readonly MAC_LOG: RegExp = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+ [\w ]+(?: \([A-Za-z]+\))?\[\d+:\d+\] /;
  private static readonly GTK_WARNING: RegExp = /^\([\w.-]+:\d+\): Gtk-WARNING \*\*: /;
  private static readonly GTK_CONTINUATION: RegExp = /^This may indicate that pixbuf loaders or the mime database could not be found\.$/;

  private isAfterGtkWarning: boolean = false;

  public classify(text: string): ClassifiedLine[] {
    const lines: ClassifiedLine[] = [];
    for (const line of text.split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0)) {
      const kind = this.classifyLine(line);
      if (kind !== "expected")
        lines.push({ kind, text: line });
    }
    return lines;
  }

  private classifyLine(line: string): OutputKind {
    const isContinuation = this.isAfterGtkWarning && ErrorOutputClassifier.GTK_CONTINUATION.test(line);
    this.isAfterGtkWarning = false;
    if (ErrorOutputClassifier.EXPECTED.some(t => t.test(line)))
      return "expected";
    if (ErrorOutputClassifier.GTK_WARNING.test(line)) {
      this.isAfterGtkWarning = true;
      return "platform-log";
    }
    return isContinuation || ErrorOutputClassifier.MAC_LOG.test(line) ? "platform-log" : "failure";
  }
}
