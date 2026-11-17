/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { InjectionToken } from "@angular/core";

import type { IRowReveal } from "../interfaces/i-row-reveal";
import { Resources } from "../../resources";

export class ScrollReveal {
  public static readonly rows: InjectionToken<IRowReveal> = new InjectionToken<IRowReveal>(Resources.rowRevealToken);

  public static whenSized(element: Element, reveal: () => void): ResizeObserver {
    const observer = new ResizeObserver(() => {
      observer.disconnect();
      reveal();
    });
    observer.observe(element);
    return observer;
  }
}
