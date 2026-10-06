# Command line

**Scope:** The `teamrun` command line, `src/shell/cli`, under the [architecture's command-line rules](../../../docs/ARCHITECTURE.md#command-line).

## 1. Purpose

The command line reports on the data directory's runtime and runs the runtime's commands and the modules' own commands from a terminal or a script. It shares the runtime and the data directory with the desktop.

## 2. Commands

| Command | What it does |
|---|---|
| `teamrun status` | Reports the runtime's build, the data directory, the modules and where each stands, and the work in progress. Never starts a runtime. |
| `teamrun commands` | Lists the runtime's commands, with each one's name, title and module. The window's commands are not reachable from the command line. |
| `teamrun run <command> [<json> \| --args-file <path> \| -]` | Runs one of the runtime's commands and prints its result; a command that is not enabled now is refused. Its arguments are JSON, given inline, read from a file, or read from standard input with `-`. Pressing Ctrl+C cancels the command. |
| `teamrun <module> <command> [<argument>...] [--<option> [<value>]...]` | Runs one of a module's commands, as [module commands](#7-module-commands) describe. Pressing Ctrl+C cancels the command. |
| `teamrun open` | Starts TeamRun with the same data directory, or brings its window forward when it already runs. |
| `teamrun help [<module> [<command>]]` | Prints the usage: the command line's own commands and every module's commands, a module's commands, or one command's arguments, options and examples. Never starts a runtime. |

`commands`, `run` and module commands start a runtime when none is running. The runtime then stays up under its idle policy, so later calls attach to it.

## 3. Options

| Option | Meaning |
|---|---|
| `--data-dir <path>` | The data directory. Without it, the command line uses the same one the desktop would. |
| `--json` | Prints exactly one JSON value on standard output, and an error as `{"code","message","details"}` on standard error. |
| `--no-start` | `commands`, `run` and module commands fail with exit code 3 instead of starting a runtime. |
| `--take-over` | `commands`, `run` and module commands take over another build's runtime when this build is newer and that runtime is idle. |
| `--timeout <seconds>` | How long `run`'s command or a module command may take, in whole seconds from 1 to 3600. |
| `--help` | Prints the help of the command it follows, as `teamrun help` does, and runs nothing. |

The command line never asks a question; it reports and exits.

## 4. Exit codes

The exit codes are stable; scripts may rely on them.

| Code | Meaning |
|---|---|
| 0 | Success. |
| 1 | The command, or the method it called, failed, or a runtime could not start. |
| 2 | The command line, or a command's arguments, are not valid. |
| 3 | No runtime is running, and the command does not start one. |
| 4 | Another build's runtime owns the data directory: an older one without `--take-over`, a newer one, or one with work in progress. The error names the running build and its program. |
| 5 | The data directory cannot be used: it holds data from before the shell, another program's runtime owns it, or it is not a writable folder. Data from before the shell is reported and never moved. |
| 6 | The command timed out or was cancelled. |
| 7 | The command's module is not active: it failed or is blocked in the runtime, or its command-line part failed to start in this command line. The error names the module, its cause and, for a blocked module, the dependency that blocks it. |

A failure from the runtime keeps the protocol's code in the JSON error. When the connection to the runtime ends during a command, the code is `Disconnected`, as in the desktop, and the exit code is 1. A command the runtime leaves unanswered on an open connection reports `Unavailable`.

## 5. Development

In a checkout, `npm run teamrun -- <command> [options]` runs the command line on the development app, with the checkout's own data directory unless `--data-dir` or `TEAMRUN_DATA_DIR` names another. A relative `--data-dir` is resolved from the folder `npm` was started in.

## 7. Module commands

A module adds its commands under its id, as `teamrun <module> <command>`, where the command is the kebab-case form of the name the module declares: `notes.addNote` is `teamrun notes add-note`. The [architecture](../../../docs/ARCHITECTURE.md#command-line-commands) owns how a module declares them.

- **Reserved words.** A module's id is never one of the command line's own commands: `status`, `commands`, `run`, `open` and `help`. The build refuses a module whose id is one of them. A new command of the command line's own is added to this list first, so the build then refuses a module that already uses its name.
- **Reading the call.** Arguments come in their declared order. An option is `--name value` or `--name=value`, a `Boolean` option is `--name` alone, and a repeated option may be given more than once, its values in order. A `Number` takes a decimal number, such as `3` or `-2.5`. Options, including the [global options](#3-options), may stand anywhere after the command, among the arguments. `--` ends the options: everything after it is an argument, even when it starts with `--`. A missing required argument or option, an unknown option, a value of the wrong type, a value given to a `Boolean` option or an argument too many exits with code 2 and prints the command's usage, and no runtime starts.
- **Running.** The command line then reaches the runtime as `run` does, starting one unless `--no-start` is given. It runs the command only when the command's module is active, after starting that module's command-line part and those of its dependencies; otherwise it exits with code 7. `teamrun run` exits with code 7 too for a runtime command whose module is not active.
- **Output.** A command prints its text on standard output, and with `--json` exactly its one JSON value instead. A command that fails exits with code 1 and prints its error, with `--json` as `{"code","message","details"}` on standard error, where the code is the module's own or the protocol's. A command that refuses its arguments exits with code 2.
- **Help.** `teamrun help` lists the command line's own commands, then each module's commands under the module's display name, in module order, each with its summary. `teamrun help <module>` and `teamrun <module> --help` list one module's commands. `teamrun help <module> <command>` and `teamrun <module> <command> --help` print the command's usage, description, arguments, options with their types and defaults, and examples. Help reads only the build's declarations, so it never starts or reaches a runtime and lists every module of the build, active or not.

An unknown module or command, or a module without a command, exits with code 2 and prints the usage.
