/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type WritableSignal, signal } from "@angular/core";

import { GallerySize } from "../../enums/gallery-size";
import { PanelSurface } from "../../enums/panel-surface";
import { SashOrientation } from "../../enums/sash-orientation";
import { VirtualListException } from "../../exceptions/virtual-list.exception";
import { ArrayVirtualListSource } from "../../models/array-virtual-list-source";
import { TreeMove } from "../../models/tree-move";
import { TreeNode } from "../../models/tree.node";
import { IconButtonComponent } from "../icon-button/icon-button.component";
import { PanelCardComponent } from "../panel-card/panel-card.component";
import { SashComponent } from "../sash/sash.component";
import { SectionHeaderComponent } from "../section-header/section-header.component";
import { TabComponent } from "../tab/tab.component";
import { ToolbarButtonComponent } from "../toolbar-button/toolbar-button.component";
import { ToolbarItemDirective } from "../toolbar/toolbar-item.directive";
import { ToolbarDirective } from "../toolbar/toolbar.directive";
import { TooltipDirective } from "../tooltip/tooltip.directive";
import { TreeComponent } from "../tree/tree.component";
import { ViewBadgeComponent } from "../view-badge/view-badge.component";
import { VirtualListComponent } from "../virtual-list/virtual-list.component";
import { VirtualRowDirective } from "../virtual-list/virtual-row.directive";
import { GalleryCellComponent } from "./gallery-cell.component";
import { GalleryFeedComponent } from "./gallery-feed.component";
import { GalleryResources } from "./gallery-resources";
import { GallerySpecimenComponent } from "./gallery-specimen.component";
import { GalleryStateDirective } from "./gallery-state.directive";
import { GalleryVirtualListSource } from "./gallery-virtual-list-source";

@Component({
  selector: "tr-gallery-navigation",
  imports: [GalleryCellComponent, GalleryFeedComponent, GallerySpecimenComponent, GalleryStateDirective, IconButtonComponent, PanelCardComponent, SashComponent, SectionHeaderComponent, TabComponent, ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective, TooltipDirective, TreeComponent, ViewBadgeComponent, VirtualListComponent,
    VirtualRowDirective],
  templateUrl: "./gallery-navigation.component.html",
  styleUrl: "./gallery-navigation.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GalleryNavigationComponent {
  protected readonly text: typeof GalleryResources.text = GalleryResources.text;
  protected readonly sizes: typeof GallerySize = GallerySize;
  protected readonly surfaces: typeof PanelSurface = PanelSurface;
  protected readonly orientations: typeof SashOrientation = SashOrientation;
  protected readonly recentRows: readonly TreeNode[] = [
    new TreeNode(this.text.sectionRowNotes, this.text.sectionRowNotes, this.text.glyphDescription),
    new TreeNode(this.text.sectionRowPlan, this.text.sectionRowPlan, this.text.glyphDescription)
  ];
  protected readonly olderRows: readonly TreeNode[] = [
    new TreeNode(this.text.sectionRowDraft, this.text.sectionRowDraft, this.text.glyphDescription),
    new TreeNode(this.text.sectionRowReview, this.text.sectionRowReview, this.text.glyphDescription)
  ];
  protected readonly treeNodes: WritableSignal<readonly TreeNode[]> = signal([
    TreeNode.open(this.text.treeProject, this.text.treeProject, this.text.glyphFolder, [
      new TreeNode(this.text.treeSource, this.text.treeSource, this.text.glyphFolder, [
        new TreeNode(this.text.treeApp, this.text.treeApp, this.text.glyphDescription),
        new TreeNode(this.text.treeStyles, this.text.treeStyles, this.text.glyphDescription)
      ]),
      new TreeNode(this.text.treeReadme, this.text.treeReadme, this.text.glyphDescription)
    ]),
    new TreeNode(this.text.treeNotes, this.text.treeNotes, this.text.glyphDescription),
    new TreeNode(this.text.treeLong, this.text.treeLong, this.text.glyphDescription)
  ]);
  protected readonly treeCurrent: WritableSignal<string> = signal(GalleryResources.text.treeNotes);
  protected readonly listItems: ArrayVirtualListSource<string> = new ArrayVirtualListSource(
    Array.from({ length: GalleryResources.virtualListLength }, (_, t) => `${this.text.virtualListItem} ${t + 1}`), t => t, GalleryResources.virtualListEstimate);
  protected readonly listLoading: GalleryVirtualListSource = new GalleryVirtualListSource(GalleryResources.virtualListLength, GalleryResources.virtualListEstimate, () => new Promise(() => undefined));
  protected readonly listFailing: GalleryVirtualListSource = new GalleryVirtualListSource(GalleryResources.virtualListLength, GalleryResources.virtualListEstimate,
    () => Promise.reject(new VirtualListException(this.text.virtualListRefusal)));
  protected readonly listSelected: WritableSignal<number | null> = signal(GalleryResources.virtualListSelected);

  protected moveTreeNode(move: TreeMove): void {
    this.treeNodes.update(t => move.apply(t));
  }
}
