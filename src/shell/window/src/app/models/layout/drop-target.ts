/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Bounds } from "./bounds";
import type { Layout } from "./layout";
import type { LayoutGeometry } from "./layout-geometry";
import type { Tab } from "./tab";

export abstract class DropTarget {
  public abstract place(layout: Layout, tab: Tab): Layout;

  public abstract preview(geometry: LayoutGeometry): Bounds | null;

  public abstract equals(other: DropTarget | null): boolean;
}
