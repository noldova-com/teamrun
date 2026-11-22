/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class UnhandledRejections {
  public readonly reasons: unknown[] = [];
  private readonly record: (event: PromiseRejectionEvent) => void;

  private constructor() {
    this.record = event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.reasons.push(event.reason);
    };
    window.addEventListener("unhandledrejection", this.record, { capture: true });
  }

  public static catch(): UnhandledRejections {
    return new UnhandledRejections();
  }

  public stop(): void {
    window.removeEventListener("unhandledrejection", this.record, { capture: true });
  }
}
