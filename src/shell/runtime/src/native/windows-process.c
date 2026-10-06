/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

#define WIN32_LEAN_AND_MEAN
#include <stdint.h>
#include <stdio.h>
#include <windows.h>
#include <tlhelp32.h>
#include <node_api.h>

#define IMAGE_PATH_LENGTH 32768
#define MESSAGE_LENGTH 160
#define TERMINATED_EXIT_CODE 1

static napi_value fail(napi_env env) {
  bool is_pending = false;
  if (napi_is_exception_pending(env, &is_pending) == napi_ok && !is_pending)
    napi_throw_error(env, NULL, "A Node-API call in the Windows process addon failed.");
  return NULL;
}

static napi_value fail_windows(napi_env env, const char *function, DWORD error) {
  char message[MESSAGE_LENGTH];
  snprintf(message, sizeof(message), "%s failed with Windows error %lu.", function, (unsigned long)error);
  napi_throw_error(env, NULL, message);
  return NULL;
}

static bool read_arguments(napi_env env, napi_callback_info info, size_t count, napi_value *values) {
  size_t given = count;
  if (napi_get_cb_info(env, info, &given, values, NULL, NULL) != napi_ok) {
    fail(env);
    return false;
  }
  if (given < count) {
    napi_throw_type_error(env, NULL, "The Windows process addon was called with too few arguments.");
    return false;
  }
  return true;
}

static bool read_handle(napi_env env, napi_callback_info info, HANDLE *handle) {
  napi_value value;
  uint64_t number = 0;
  bool is_lossless = false;
  if (!read_arguments(env, info, 1, &value))
    return false;
  if (napi_get_value_bigint_uint64(env, value, &number, &is_lossless) != napi_ok || !is_lossless || number == 0) {
    napi_throw_type_error(env, NULL, "The Windows process addon expects a handle from openProcess.");
    return false;
  }
  *handle = (HANDLE)(uintptr_t)number;
  return true;
}

static bool read_number(napi_env env, napi_value value, uint32_t *number) {
  if (napi_get_value_uint32(env, value, number) != napi_ok) {
    napi_throw_type_error(env, NULL, "The Windows process addon expects a process id and access rights as numbers.");
    return false;
  }
  return true;
}

static napi_value to_boolean(napi_env env, bool value) {
  napi_value result;
  return napi_get_boolean(env, value, &result) == napi_ok ? result : fail(env);
}

static napi_value to_null(napi_env env) {
  napi_value result;
  return napi_get_null(env, &result) == napi_ok ? result : fail(env);
}

static napi_value append_process(napi_env env, napi_value list, uint32_t index, const PROCESSENTRY32W *entry) {
  napi_value pair;
  napi_value process_id;
  napi_value parent_id;
  if (napi_create_array_with_length(env, 2, &pair) != napi_ok
      || napi_create_uint32(env, entry->th32ProcessID, &process_id) != napi_ok
      || napi_create_uint32(env, entry->th32ParentProcessID, &parent_id) != napi_ok
      || napi_set_element(env, pair, 0, process_id) != napi_ok
      || napi_set_element(env, pair, 1, parent_id) != napi_ok
      || napi_set_element(env, list, index, pair) != napi_ok)
    return fail(env);
  return pair;
}

static napi_value list_processes(napi_env env, napi_callback_info info) {
  napi_value list;
  PROCESSENTRY32W entry;
  uint32_t index = 0;
  DWORD error;
  BOOL is_found;
  HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  (void)info;
  if (snapshot == INVALID_HANDLE_VALUE)
    return fail_windows(env, "CreateToolhelp32Snapshot", GetLastError());
  if (napi_create_array(env, &list) != napi_ok) {
    CloseHandle(snapshot);
    return fail(env);
  }
  entry.dwSize = sizeof(entry);
  for (is_found = Process32FirstW(snapshot, &entry); is_found; is_found = Process32NextW(snapshot, &entry))
    if (append_process(env, list, index++, &entry) == NULL) {
      CloseHandle(snapshot);
      return NULL;
    }
  error = GetLastError();
  CloseHandle(snapshot);
  return error == ERROR_NO_MORE_FILES ? list : fail_windows(env, "Process32NextW", error);
}

static napi_value open_process(napi_env env, napi_callback_info info) {
  napi_value values[2];
  napi_value result;
  uint32_t process_id;
  uint32_t access;
  HANDLE handle;
  if (!read_arguments(env, info, 2, values) || !read_number(env, values[0], &process_id) || !read_number(env, values[1], &access))
    return NULL;
  handle = OpenProcess(access, FALSE, process_id);
  if (handle == NULL)
    return napi_create_uint32(env, GetLastError(), &result) == napi_ok ? result : fail(env);
  if (napi_create_bigint_uint64(env, (uint64_t)(uintptr_t)handle, &result) != napi_ok) {
    CloseHandle(handle);
    return fail(env);
  }
  return result;
}

static napi_value read_creation_time(napi_env env, napi_callback_info info) {
  HANDLE handle;
  FILETIME created;
  FILETIME exited;
  FILETIME kernel;
  FILETIME user;
  napi_value result;
  if (!read_handle(env, info, &handle))
    return NULL;
  if (!GetProcessTimes(handle, &created, &exited, &kernel, &user))
    return to_null(env);
  return napi_create_bigint_uint64(env, ((uint64_t)created.dwHighDateTime << 32) | created.dwLowDateTime, &result) == napi_ok ? result : fail(env);
}

static napi_value read_image_path(napi_env env, napi_callback_info info) {
  HANDLE handle;
  WCHAR path[IMAGE_PATH_LENGTH];
  DWORD length = IMAGE_PATH_LENGTH;
  napi_value result;
  if (!read_handle(env, info, &handle))
    return NULL;
  if (!QueryFullProcessImageNameW(handle, 0, path, &length))
    return to_null(env);
  return napi_create_string_utf16(env, (const char16_t *)path, length, &result) == napi_ok ? result : fail(env);
}

static napi_value terminate_process(napi_env env, napi_callback_info info) {
  HANDLE handle;
  if (!read_handle(env, info, &handle))
    return NULL;
  return to_boolean(env, TerminateProcess(handle, TERMINATED_EXIT_CODE) != 0);
}

static napi_value has_exited(napi_env env, napi_callback_info info) {
  HANDLE handle;
  if (!read_handle(env, info, &handle))
    return NULL;
  return to_boolean(env, WaitForSingleObject(handle, 0) == WAIT_OBJECT_0);
}

static napi_value close_handle(napi_env env, napi_callback_info info) {
  HANDLE handle;
  if (read_handle(env, info, &handle))
    CloseHandle(handle);
  return NULL;
}

NAPI_MODULE_INIT() {
  napi_property_descriptor functions[] = {
    { "listProcesses", NULL, list_processes, NULL, NULL, NULL, napi_enumerable, NULL },
    { "openProcess", NULL, open_process, NULL, NULL, NULL, napi_enumerable, NULL },
    { "readCreationTime", NULL, read_creation_time, NULL, NULL, NULL, napi_enumerable, NULL },
    { "readImagePath", NULL, read_image_path, NULL, NULL, NULL, napi_enumerable, NULL },
    { "terminateProcess", NULL, terminate_process, NULL, NULL, NULL, napi_enumerable, NULL },
    { "hasExited", NULL, has_exited, NULL, NULL, NULL, napi_enumerable, NULL },
    { "closeHandle", NULL, close_handle, NULL, NULL, NULL, napi_enumerable, NULL }
  };
  return napi_define_properties(env, exports, sizeof(functions) / sizeof(functions[0]), functions) == napi_ok ? exports : fail(env);
}
