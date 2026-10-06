/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CdkTreeNode } from "@angular/cdk/tree";
import { Directive, ElementRef, inject } from "@angular/core";

import type { TreeNode } from "../../models/tree.node";

@Directive({ selector: "[trTreeRow]" })
export class TreeRowDirective {
  public readonly node: CdkTreeNode<TreeNode, string> = inject<CdkTreeNode<TreeNode, string>>(CdkTreeNode);
  public readonly element: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
}
