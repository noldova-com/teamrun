/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";

import { TreeComponent } from "../../src/app/components/tree/tree.component";
import type { TreeMove } from "../../src/app/models/tree-move";
import { TreeNode } from "../../src/app/models/tree-node";

@Component({
  imports: [TreeComponent],
  template: `
    <div class="frame" [style.height]="height()" style="overflow-y: auto">
      <tr-tree label="Files" [nodes]="nodes()" [movable]="movable()" (activated)="activations.push($event.id)" (moved)="receive($event)" />
    </div>
  `
})
export class MovableTreeHostComponent {
  public readonly nodes = signal<readonly TreeNode[]>([
    TreeNode.open("project", "Project", "folder", [
      new TreeNode("source", "Source", "folder", [new TreeNode("app", "App")]),
      new TreeNode("readme", "Readme", "description")
    ]),
    new TreeNode("notes", "Notes", "description"),
    new TreeNode("trash", "Trash", "delete")
  ]);
  public readonly movable = signal(true);
  public readonly height = signal("auto");
  public readonly applying = signal(false);
  public readonly moves: TreeMove[] = [];
  public readonly activations: string[] = [];

  public receive(move: TreeMove): void {
    this.moves.push(move);
    if (this.applying())
      this.nodes.update(t => move.apply(t));
  }
}
