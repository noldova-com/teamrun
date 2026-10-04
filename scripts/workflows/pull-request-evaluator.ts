/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type PullRequestCheck from "./pull-request-check.ts";
import PullRequestFinding from "./pull-request-finding.ts";
import type PullRequestSnapshot from "./pull-request-snapshot.ts";
import type WatchedRepository from "./watched-repository.ts";

export default class PullRequestEvaluator {
  public evaluate(repository: WatchedRepository, pull: PullRequestSnapshot): readonly PullRequestFinding[] {
    const findings: PullRequestFinding[] = [];
    const required = PullRequestEvaluator.selectLatest(pull.checks, repository.requiredChecks);
    const failed = required.filter(t => t.hasFailed);
    const hasPassed = required.length === repository.requiredChecks.length && required.length > 0 && required.every(t => t.hasPassed);
    if (pull.buildRuns === 0)
      findings.push(PullRequestFinding.noBuild(pull.pushedAt, pull.head));
    if (pull.isConflicted)
      findings.push(PullRequestFinding.conflict(new Date(Math.max(pull.pushedAt.getTime(), repository.baseChangedAt.getTime())), repository.defaultBranch));
    if (failed.length > 0)
      findings.push(PullRequestFinding.failed(PullRequestEvaluator.finishedAt(failed), failed.map(t => t.name)));
    if (hasPassed && !pull.isConflicted && !pull.hasAutoMerge && (pull.isApproved || pull.hadAutoMerge))
      findings.push(PullRequestFinding.notMerging(PullRequestEvaluator.finishedAt(required)));
    return findings;
  }

  private static selectLatest(checks: readonly PullRequestCheck[], names: readonly string[]): readonly PullRequestCheck[] {
    const latest = new Map<string, PullRequestCheck>();
    for (const check of checks.filter(t => names.includes(t.name))) {
      const known = latest.get(check.name);
      if (known === undefined || (check.startedTime ?? Infinity) > (known.startedTime ?? Infinity))
        latest.set(check.name, check);
    }
    return [...latest.values()];
  }

  private static finishedAt(checks: readonly PullRequestCheck[]): Date {
    return new Date(Math.max(...checks.map(t => t.finishedTime)));
  }
}
