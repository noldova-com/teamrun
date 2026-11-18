/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ResizeObserverLoops {
  private static readonly PREFIX: string = "ResizeObserver loop";
  private static recorder: ResizeObserverLoops | null = null;

  private readonly reported: string[] = [];

  public constructor(target: EventTarget) {
    target.addEventListener("error", event => {
      if (event instanceof ErrorEvent && event.message.startsWith(ResizeObserverLoops.PREFIX))
        this.reported.push(event.message);
    });
  }

  public static get shared(): ResizeObserverLoops {
    ResizeObserverLoops.recorder ??= new ResizeObserverLoops(globalThis);
    return ResizeObserverLoops.recorder;
  }

  public take(): readonly string[] {
    return this.reported.splice(0);
  }
}
