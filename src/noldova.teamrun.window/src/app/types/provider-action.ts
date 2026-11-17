/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChatAction } from "../enums/chat-action";

export type ProviderAction = ChatAction.AddProvider | ChatAction.ChangeProvider | ChatAction.EnableProvider | ChatAction.DisableProvider
  | ChatAction.CheckProvider | ChatAction.SignIn | ChatAction.SignOut | ChatAction.InstallKind | ChatAction.RemoveProvider | ChatAction.InstallTool;
