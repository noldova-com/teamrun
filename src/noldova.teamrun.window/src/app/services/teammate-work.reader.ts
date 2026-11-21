/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, signal, type WritableSignal } from "@angular/core";

import "@noldova/context.core";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { GitHubNames } from "@noldova/git.github.protocol";
import { BranchPullRequest, BranchQuery, HostSignIn, ReferenceState, SignInState } from "@noldova/git.hosting.protocol";
import { GitChanged, GitFolderParams, GitNames, GitStatus } from "@noldova/git.protocol";
import { EventName, Message, MethodName, Page, PageEditedListRequest, PageEventName, PageMethodName, TeammateIdParams, TeammateWork } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";
import { TeammateSourceState } from "../enums/teammate-source-state";
import { TeammateGit } from "../models/teammate-git";
import { TeammatePullRequest } from "../models/teammate-pull-request";
import { TeammatePullRequests } from "../models/teammate-pull-requests";
import { GitHubReferenceLinks } from "./github-reference-links";

export class TeammateWorkReader {
  private static readonly openStates: readonly ReferenceState[] = [ReferenceState.Open, ReferenceState.Draft];

  private readonly context: IWindowPartContext;
  private readonly teammateId: string;
  private readonly workSignal: WritableSignal<TeammateWork | null> = signal(null);
  private readonly artifactsSignal: WritableSignal<readonly Page[]> = signal([]);
  private readonly gitSignal: WritableSignal<TeammateGit> = signal(TeammateGit.reading);
  private readonly pullRequestsSignal: WritableSignal<TeammatePullRequests> = signal(TeammatePullRequests.reading);
  private readonly workFailureSignal: WritableSignal<string | null> = signal(null);
  private readonly artifactsFailureSignal: WritableSignal<string | null> = signal(null);
  private readonly releases: readonly (() => void)[];
  private watched: string | null = null;
  private signIn: SignInState | null = null;
  private workRead: number = 0;
  private artifactsRead: number = 0;
  private gitRead: number = 0;
  private pullRequestsRead: number = 0;

  public readonly work: Signal<TeammateWork | null> = this.workSignal.asReadonly();
  public readonly artifacts: Signal<readonly Page[]> = this.artifactsSignal.asReadonly();
  public readonly git: Signal<TeammateGit> = this.gitSignal.asReadonly();
  public readonly pullRequests: Signal<TeammatePullRequests> = this.pullRequestsSignal.asReadonly();
  public readonly workFailure: Signal<string | null> = this.workFailureSignal.asReadonly();
  public readonly artifactsFailure: Signal<string | null> = this.artifactsFailureSignal.asReadonly();

  public constructor(context: IWindowPartContext, teammateId: string) {
    this.context = context;
    this.teammateId = teammateId;
    this.releases = [
      context.onEvent(Resources.formatQualifiedName(EventName.MessageUpdated), t => this.onMessage(Message.fromJson(t))),
      context.onEvent(Resources.formatQualifiedName(EventName.StateResyncRequested), () => this.readAll()),
      context.onEvent(Resources.formatQualifiedName(PageEventName.PageShown), () => void this.readArtifactsAsync()),
      context.onEvent(Resources.formatQualifiedName(PageEventName.PageUpdated), () => void this.readArtifactsAsync()),
      context.onEvent(GitNames.changedEvent, t => this.onGitChanged(GitChanged.fromJson(t).folder)),
      context.onEvent(GitHubNames.signInChangedEvent, t => this.onSignIn(HostSignIn.fromJson(t).state)),
      context.onDependencyChanged(moduleId => this.onDependency(moduleId))
    ];
    this.readAll();
  }

  public stop(): void {
    this.workRead++;
    this.artifactsRead++;
    this.gitRead++;
    this.pullRequestsRead++;
    for (const release of this.releases)
      release();
    void this.followAsync(null);
  }

  private readAll(): void {
    void this.readWorkAsync();
    void this.readArtifactsAsync();
  }

  private onMessage(message: Message): void {
    if (message.teammateId === this.teammateId && !Object.isNull(message.endedAt))
      void this.readWorkAsync();
  }

  private onGitChanged(folder: string): void {
    if (folder === this.watched)
      void this.readGitAsync();
  }

  private onSignIn(state: SignInState): void {
    if (state === SignInState.Waiting)
      return;
    this.signIn = state;
    void this.readPullRequestsAsync();
  }

  private onDependency(moduleId: string): void {
    if (moduleId === GitNames.moduleId) {
      this.watched = null;
      void this.readGitAsync();
    }
    if (moduleId === GitNames.moduleId || moduleId === GitHubNames.moduleId) {
      this.signIn = null;
      void this.readPullRequestsAsync();
    }
  }

  private async readWorkAsync(): Promise<void> {
    const read = ++this.workRead;
    try {
      const work = TeammateWork.fromJson(await this.context.requestAsync(Resources.formatQualifiedName(MethodName.TeammateWorkRead),
        new TeammateIdParams(this.teammateId).toJson()));
      if (read !== this.workRead)
        return;
      this.workSignal.set(work);
      this.workFailureSignal.set(null);
      void this.readGitAsync();
      void this.readPullRequestsAsync();
    }
    catch (error) {
      const message = TeammateWorkReader.messageOf(error);
      if (read === this.workRead)
        this.workFailureSignal.set(message);
    }
  }

  private async readArtifactsAsync(): Promise<void> {
    const read = ++this.artifactsRead;
    try {
      const value = await this.context.requestAsync(Resources.formatQualifiedName(PageMethodName.PageEditedList),
        new PageEditedListRequest(this.teammateId).toJson());
      const artifacts = Array.isArray(value) ? value.map(t => Page.fromJson(t)) : [];
      if (read !== this.artifactsRead)
        return;
      this.artifactsSignal.set(artifacts);
      this.artifactsFailureSignal.set(null);
    }
    catch (error) {
      const message = TeammateWorkReader.messageOf(error);
      if (read === this.artifactsRead)
        this.artifactsFailureSignal.set(message);
    }
  }

  private async readGitAsync(): Promise<void> {
    const read = ++this.gitRead;
    const folder = this.workSignal()?.folder ?? null;
    const show = (git: TeammateGit): void => {
      if (read === this.gitRead)
        this.gitSignal.set(git);
    };
    if (!this.context.isDependencyActive(GitNames.moduleId)) {
      this.watched = null;
      show(new TeammateGit(TeammateSourceState.ModuleMissing, folder, null));
      return;
    }
    await this.followAsync(folder);
    if (Object.isNull(folder)) {
      show(new TeammateGit(TeammateSourceState.NoFolder, null, null));
      return;
    }
    try {
      const status = await this.readStatusAsync(folder);
      const previous = this.gitSignal().status;
      show(new TeammateGit(TeammateSourceState.Shown, folder, status));
      if (read === this.gitRead && !Object.isNull(previous) && (previous.branch !== status.branch || previous.head !== status.head))
        void this.readPullRequestsAsync();
    }
    catch (error) {
      show(new TeammateGit(TeammateSourceState.Failed, folder, null, TeammateWorkReader.messageOf(error)));
    }
  }

  private async followAsync(folder: string | null): Promise<void> {
    const previous = this.watched;
    if (previous === folder)
      return;
    this.watched = folder;
    for (const [method, target] of [[GitNames.unwatchMethod, previous], [GitNames.watchMethod, folder]] as const) {
      if (!Object.isNull(target))
        await this.context.requestAsync(method, new GitFolderParams(target).toJson())
          .catch((error: unknown) => this.context.log(Resources.formatTeammateFolderUnwatched(target, TeammateWorkReader.messageOf(error))));
    }
  }

  private async readPullRequestsAsync(): Promise<void> {
    const read = ++this.pullRequestsRead;
    const show = (pullRequests: TeammatePullRequests): void => {
      if (read === this.pullRequestsRead)
        this.pullRequestsSignal.set(pullRequests);
    };
    if (!this.context.isDependencyActive(GitNames.moduleId) || !this.context.isDependencyActive(GitHubNames.moduleId)) {
      show(new TeammatePullRequests(TeammateSourceState.ModuleMissing, []));
      return;
    }
    try {
      this.signIn ??= HostSignIn.fromJson(await this.context.requestAsync(GitHubNames.readSignInMethod, null)).state;
      if (this.signIn !== SignInState.SignedIn) {
        show(new TeammatePullRequests(TeammateSourceState.SignedOut, []));
        return;
      }
      const found = await Promise.all((this.workSignal()?.folders ?? []).map(t => this.readFolderPullRequestAsync(t)));
      const items = new Map<string, TeammatePullRequest>();
      for (const item of found) {
        if (!Object.isNull(item) && !items.has(item.pullRequest.url))
          items.set(item.pullRequest.url, item);
      }
      show(new TeammatePullRequests(TeammateSourceState.Shown, [...items.values()]));
    }
    catch (error) {
      show(new TeammatePullRequests(TeammateSourceState.Failed, [], TeammateWorkReader.messageOf(error)));
    }
  }

  private async readFolderPullRequestAsync(folder: string): Promise<TeammatePullRequest | null> {
    let status: GitStatus;
    try {
      status = await this.readStatusAsync(folder);
    }
    catch (error) {
      this.context.log(Resources.formatTeammateFolderUnread(folder, TeammateWorkReader.messageOf(error)));
      return null;
    }
    const home = GitHubReferenceLinks.homeOf(status.remote);
    if (Object.isNull(home) || Object.isNull(status.branch))
      return null;
    const answer = BranchPullRequest.fromJson(await this.context.requestAsync(GitHubNames.readBranchPullRequestMethod,
      new BranchQuery(Resources.gitHubReferenceHost, home, status.branch, status.head).toJson()));
    const { pullRequest, reviewDecision } = answer;
    return !Object.isNull(pullRequest) && !Object.isNull(reviewDecision) && TeammateWorkReader.openStates.includes(pullRequest.state)
      ? new TeammatePullRequest(folder, pullRequest, answer.checksState, reviewDecision) : null;
  }

  private async readStatusAsync(folder: string): Promise<GitStatus> {
    return GitStatus.fromJson(await this.context.requestAsync(GitNames.statusMethod, new GitFolderParams(folder).toJson()));
  }

  private static messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
