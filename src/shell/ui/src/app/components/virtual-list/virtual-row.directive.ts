/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Directive, TemplateRef, inject, input } from "@angular/core";

import type { IVirtualRowContext } from "../../interfaces/i-virtual-row-context";
import type { VirtualListSource } from "../../models/virtual-list-source";

@Directive({ selector: "ng-template[trVirtualRow]" })
export class VirtualRowDirective<T> {
  public readonly template: TemplateRef<IVirtualRowContext<T>> = inject<TemplateRef<IVirtualRowContext<T>>>(TemplateRef);
  public readonly trVirtualRow = input.required<VirtualListSource<T>>();
  public readonly described = input<boolean>(false, { alias: "trVirtualRowDescribed" });

  public static ngTemplateContextGuard<T>(_: VirtualRowDirective<T>, _context: unknown): _context is IVirtualRowContext<T> {
    return true;
  }
}
