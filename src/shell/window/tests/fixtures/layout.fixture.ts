/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../src/app/enums/dock-side";
import type { SplitAxis } from "../../src/app/enums/split-axis";
import { DocumentTab } from "../../src/app/models/layout/document-tab";
import type { LayoutNode } from "../../src/app/models/layout/layout.node";
import { SplitPart } from "../../src/app/models/layout/split-part";
import { SplitNode } from "../../src/app/models/layout/split.node";
import { ViewRegistry } from "../../src/app/models/layout/view-registry";
import { ViewTab } from "../../src/app/models/layout/view-tab";
import { ViewType } from "../../src/app/models/layout/view-type";

export class LayoutFixture {
  public static readonly files: ViewTab = new ViewTab("files.tree");
  public static readonly search: ViewTab = new ViewTab("files.search");
  public static readonly changes: ViewTab = new ViewTab("git.changes");
  public static readonly terminal: ViewTab = new ViewTab("terminal.shell", "1");
  public static readonly secondTerminal: ViewTab = new ViewTab("terminal.shell", "2");
  public static readonly plan: DocumentTab = new DocumentTab("notes.note", "plan");
  public static readonly todo: DocumentTab = new DocumentTab("notes.note", "todo");
  public static readonly settings: DocumentTab = new DocumentTab("shell.settings");

  public static createSplit(id: number, axis: SplitAxis, nodes: readonly LayoutNode[], weights: readonly number[]): SplitNode {
    return new SplitNode(id, axis, nodes.map((t, index) => new SplitPart(t, weights[index] ?? 1)));
  }

  public static weightsOf(node: LayoutNode): readonly number[] {
    return node instanceof SplitNode ? node.parts.map(t => t.weight) : [];
  }

  public static createRegistry(): ViewRegistry {
    return new ViewRegistry([
      new ViewType("files.tree", DockSide.Left, true),
      new ViewType("files.search", DockSide.Left, false),
      new ViewType("git.changes", DockSide.Right, true),
      new ViewType("terminal.shell", DockSide.Bottom, false)
    ], ["notes.note", "shell.settings"]);
  }
}
