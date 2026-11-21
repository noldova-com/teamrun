/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, computed, effect, inject, input, type InputSignal, type Signal, untracked } from "@angular/core";

import "@noldova/context.core";
import { type IWindowPartContext, WindowPartTokens } from "@noldova/desktop.window";
import { ReferenceState } from "@noldova/git.hosting.protocol";
import { PageKind } from "@noldova/teamrun.protocol";

import { Resources } from "../../../resources";
import { OrganizationCardField } from "../../enums/organization-card-field";
import { TeammateSourceState } from "../../enums/teammate-source-state";
import type { TeammatePullRequest } from "../../models/teammate-pull-request";
import { TeammateWorkReader } from "../../services/teammate-work.reader";

@Component({
  selector: "nol-teamrun-teammate-work",
  templateUrl: "./teammate-work.component.html",
  styleUrls: ["./teammate-work.component.css"]
})
export class TeammateWorkComponent {
  private static readonly workFields: readonly OrganizationCardField[] =
    [OrganizationCardField.Git, OrganizationCardField.PullRequests, OrganizationCardField.Documents, OrganizationCardField.Artifacts];

  private readonly context: IWindowPartContext = inject(WindowPartTokens.context);
  private readonly shownWork: Signal<ReadonlySet<OrganizationCardField>> = computed(
    () => new Set(TeammateWorkComponent.workFields.filter(t => this.fields().has(t))),
    { equal: (shown, next) => [...shown].join() === [...next].join() });
  private readonly reader: Signal<TeammateWorkReader> = computed(() => new TeammateWorkReader(this.context, this.teammateId(), this.shownWork()));

  public readonly teammateId: InputSignal<string> = input.required<string>();
  public readonly fields: InputSignal<ReadonlySet<OrganizationCardField>> = input.required<ReadonlySet<OrganizationCardField>>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly showsGit: Signal<boolean> = computed(() => this.fields().has(OrganizationCardField.Git));
  protected readonly showsPullRequests: Signal<boolean> = computed(() => this.fields().has(OrganizationCardField.PullRequests));
  protected readonly showsDocuments: Signal<boolean> = computed(() => this.fields().has(OrganizationCardField.Documents));
  protected readonly showsArtifacts: Signal<boolean> = computed(() => this.fields().has(OrganizationCardField.Artifacts));
  protected readonly gitBranch: Signal<string | null> = computed(() => {
    const status = this.reader().git().status;
    return Object.isNull(status) ? null : status.branch ?? Resources.teammateNoBranch;
  });
  protected readonly gitMeta: Signal<string> = computed(() => {
    const git = this.reader().git();
    const status = git.status;
    if (Object.isNull(status))
      return TeammateWorkComponent.noteOf(git.state, git.failure, Resources.teammateGitMissing);
    const upstream = status.upstream;
    return Resources.formatTeammateGitMeta(git.changes === 0 ? Resources.teammateNoChanges : Resources.formatTeammateChanges(git.changes),
      Object.isNull(upstream) ? Resources.teammateNoUpstream : Resources.formatTeammateUpstream(upstream.ahead, upstream.behind, upstream.name));
  });
  protected readonly pullRequests: Signal<readonly TeammatePullRequest[]> = computed(() => this.reader().pullRequests().items);
  protected readonly pullRequestsNote: Signal<string | null> = computed(() => {
    const { state, items, failure } = this.reader().pullRequests();
    if (state !== TeammateSourceState.Shown)
      return TeammateWorkComponent.noteOf(state, failure, Resources.teammateGitHubMissing);
    return items.length === 0 ? Resources.teammateNoPullRequests : null;
  });
  protected readonly documentsText: Signal<string> = computed(() => {
    const reader = this.reader();
    const work = reader.work();
    if (Object.isNull(work))
      return reader.workFailure() ?? Resources.teammateWorkReading;
    return work.documents.length === 0 ? Resources.teammateNoDocuments
      : work.documents.map(t => TeammateWorkComponent.nameOf(t.path)).join(Resources.teammateDocumentSeparator);
  });
  protected readonly artifacts: Signal<readonly (readonly [icon: string, text: string])[]> = computed(() => this.reader().artifacts()
    .map(t => [t.kind === PageKind.Canvas ? Resources.teammateCanvasIcon : Resources.teammatePageIcon,
      Resources.formatTeammateArtifact(t.kind, t.title)] as const));
  protected readonly artifactsNote: Signal<string | null> = computed(() =>
    this.reader().artifactsFailure() ?? (this.artifacts().length === 0 ? Resources.teammateNoArtifacts : null));

  public constructor() {
    effect(onCleanup => {
      const reader = this.reader();
      untracked(() => reader.start());
      onCleanup(() => reader.stop());
    });
  }

  protected numberOf(item: TeammatePullRequest): string {
    return Resources.formatTeammatePullRequestNumber(item.pullRequest.reference.number);
  }

  protected ciOf(item: TeammatePullRequest): readonly [text: string, look: string] | null {
    return Object.isNull(item.checksState) ? null : Resources.teammateCiLabels[item.checksState];
  }

  protected reviewOf(item: TeammatePullRequest): string {
    return item.pullRequest.state === ReferenceState.Draft ? Resources.teammateDraftPullRequest : Resources.teammateReviewLabels[item.reviewDecision];
  }

  private static noteOf(state: TeammateSourceState, failure: string, missing: string): string {
    switch (state) {
      case TeammateSourceState.ModuleMissing:
        return missing;
      case TeammateSourceState.NoFolder:
        return Resources.teammateNoFolder;
      case TeammateSourceState.SignedOut:
        return Resources.teammateGitHubSignedOut;
      case TeammateSourceState.Failed:
        return failure;
      default:
        return Resources.teammateWorkReading;
    }
  }

  private static nameOf(path: string): string {
    return path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  }
}
