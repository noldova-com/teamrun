/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class GitHubEvent {
  public static readonly PUSH: string = "push";
  public static readonly PULL_REQUEST: string = "pull_request";
  public static readonly MERGE_GROUP: string = "merge_group";
  public static readonly PULL_REQUEST_LEVEL: readonly string[] = [GitHubEvent.PULL_REQUEST, GitHubEvent.MERGE_GROUP];
}
