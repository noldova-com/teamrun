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
#include <stdlib.h>
#include <windows.h>
#include <wincrypt.h>
#include <softpub.h>
#include <tlhelp32.h>
#include <wchar.h>
#include <node_api.h>

#pragma comment(lib, "crypt32.lib")
#pragma comment(lib, "wintrust.lib")

#define IMAGE_PATH_LENGTH 32768
#define MESSAGE_LENGTH 160
#define TERMINATED_EXIT_CODE 0xFFFFFFFF
#define SUBJECT_FORMAT (CERT_X500_NAME_STR | CERT_NAME_STR_REVERSE_FLAG)

typedef struct {
  napi_async_work work;
  napi_deferred deferred;
  WCHAR *path;
  LONG status;
  WCHAR *message;
  WCHAR *subject;
} signature_check;

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
    napi_throw_type_error(env, NULL, "The Windows process addon expects a handle from openProcess or openFileForReading.");
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
  WCHAR *path;
  DWORD length = IMAGE_PATH_LENGTH;
  napi_value result = NULL;
  if (!read_handle(env, info, &handle))
    return NULL;
  path = malloc(IMAGE_PATH_LENGTH * sizeof(WCHAR));
  if (path == NULL) {
    napi_throw_error(env, NULL, "The Windows process addon could not allocate memory for an executable's path.");
    return NULL;
  }
  if (!QueryFullProcessImageNameW(handle, 0, path, &length))
    result = to_null(env);
  else if (napi_create_string_utf16(env, (const char16_t *)path, length, &result) != napi_ok)
    result = fail(env);
  free(path);
  return result;
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

static WCHAR *read_path(napi_env env, napi_callback_info info) {
  napi_value value;
  size_t length = 0;
  WCHAR *path;
  if (!read_arguments(env, info, 1, &value))
    return NULL;
  if (napi_get_value_string_utf16(env, value, NULL, 0, &length) != napi_ok) {
    napi_throw_type_error(env, NULL, "The Windows process addon expects a file's path as a string.");
    return NULL;
  }
  path = malloc((length + 1) * sizeof(WCHAR));
  if (path == NULL) {
    napi_throw_error(env, NULL, "The Windows process addon could not allocate memory for a file's path.");
    return NULL;
  }
  if (napi_get_value_string_utf16(env, value, (char16_t *)path, length + 1, &length) != napi_ok) {
    free(path);
    fail(env);
    return NULL;
  }
  if (wcslen(path) != length) {
    free(path);
    napi_throw_type_error(env, NULL, "The Windows process addon expects a file's path without a null character.");
    return NULL;
  }
  return path;
}

static napi_value open_file_for_reading(napi_env env, napi_callback_info info) {
  napi_value result;
  HANDLE handle;
  DWORD error;
  WCHAR *path = read_path(env, info);
  if (path == NULL)
    return NULL;
  handle = CreateFileW(path, GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  error = GetLastError();
  free(path);
  if (handle == INVALID_HANDLE_VALUE)
    return napi_create_uint32(env, error, &result) == napi_ok ? result : fail(env);
  if (napi_create_bigint_uint64(env, (uint64_t)(uintptr_t)handle, &result) != napi_ok) {
    CloseHandle(handle);
    return fail(env);
  }
  return result;
}

static napi_value close_handle(napi_env env, napi_callback_info info) {
  HANDLE handle;
  if (read_handle(env, info, &handle))
    CloseHandle(handle);
  return NULL;
}

static WCHAR *read_signer(HANDLE state) {
  CRYPT_PROVIDER_DATA *provider;
  CRYPT_PROVIDER_SGNR *signer;
  CRYPT_PROVIDER_CERT *certificate;
  DWORD length;
  WCHAR *subject;
  if (state == NULL)
    return NULL;
  provider = WTHelperProvDataFromStateData(state);
  signer = provider == NULL ? NULL : WTHelperGetProvSignerFromChain(provider, 0, FALSE, 0);
  certificate = signer == NULL ? NULL : WTHelperGetProvCertFromChain(signer, 0);
  if (certificate == NULL || certificate->pCert == NULL)
    return NULL;
  length = CertNameToStrW(X509_ASN_ENCODING, &certificate->pCert->pCertInfo->Subject, SUBJECT_FORMAT, NULL, 0);
  subject = malloc(length * sizeof(WCHAR));
  if (subject != NULL)
    CertNameToStrW(X509_ASN_ENCODING, &certificate->pCert->pCertInfo->Subject, SUBJECT_FORMAT, subject, length);
  return subject;
}

static void verify_signature_execute(napi_env env, void *data) {
  signature_check *check = data;
  GUID action = WINTRUST_ACTION_GENERIC_VERIFY_V2;
  WINTRUST_FILE_INFO file;
  WINTRUST_DATA trust;
  (void)env;
  ZeroMemory(&file, sizeof(file));
  ZeroMemory(&trust, sizeof(trust));
  file.cbStruct = sizeof(file);
  file.pcwszFilePath = check->path;
  trust.cbStruct = sizeof(trust);
  trust.dwUIChoice = WTD_UI_NONE;
  trust.fdwRevocationChecks = WTD_REVOKE_NONE;
  trust.dwProvFlags = WTD_REVOCATION_CHECK_NONE;
  trust.dwUnionChoice = WTD_CHOICE_FILE;
  trust.pFile = &file;
  trust.dwStateAction = WTD_STATEACTION_VERIFY;
  check->status = WinVerifyTrust((HWND)INVALID_HANDLE_VALUE, &action, &trust);
  check->subject = read_signer(trust.hWVTStateData);
  trust.dwStateAction = WTD_STATEACTION_CLOSE;
  WinVerifyTrust((HWND)INVALID_HANDLE_VALUE, &action, &trust);
  FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS, NULL, (DWORD)check->status, 0,
    (LPWSTR)&check->message, 0, NULL);
}

static napi_value to_signature(napi_env env, const signature_check *check) {
  napi_value signature;
  napi_value status;
  napi_value message;
  napi_value subject;
  if (napi_create_object(env, &signature) != napi_ok
      || napi_create_uint32(env, (uint32_t)check->status, &status) != napi_ok
      || napi_create_string_utf16(env, (const char16_t *)(check->message == NULL ? L"" : check->message), NAPI_AUTO_LENGTH, &message) != napi_ok
      || (check->subject == NULL ? napi_get_null(env, &subject)
        : napi_create_string_utf16(env, (const char16_t *)check->subject, NAPI_AUTO_LENGTH, &subject)) != napi_ok
      || napi_set_named_property(env, signature, "status", status) != napi_ok
      || napi_set_named_property(env, signature, "message", message) != napi_ok
      || napi_set_named_property(env, signature, "subject", subject) != napi_ok)
    return fail(env);
  return signature;
}

static void reject(napi_env env, napi_deferred deferred) {
  napi_value error = NULL;
  napi_value message;
  bool is_pending = false;
  if (napi_is_exception_pending(env, &is_pending) == napi_ok && is_pending)
    napi_get_and_clear_last_exception(env, &error);
  else if (napi_create_string_utf8(env, "The Windows process addon could not read a file's signature.", NAPI_AUTO_LENGTH, &message) == napi_ok)
    napi_create_error(env, NULL, message, &error);
  if (error != NULL)
    napi_reject_deferred(env, deferred, error);
}

static void free_check(signature_check *check) {
  free(check->path);
  free(check->subject);
  LocalFree(check->message);
  free(check);
}

static void verify_signature_complete(napi_env env, napi_status status, void *data) {
  signature_check *check = data;
  napi_value signature = status == napi_ok ? to_signature(env, check) : NULL;
  if (signature == NULL)
    reject(env, check->deferred);
  else
    napi_resolve_deferred(env, check->deferred, signature);
  napi_delete_async_work(env, check->work);
  free_check(check);
}

static napi_value verify_signature(napi_env env, napi_callback_info info) {
  napi_value name;
  napi_value promise;
  signature_check *check;
  WCHAR *path = read_path(env, info);
  if (path == NULL)
    return NULL;
  check = calloc(1, sizeof(*check));
  if (check == NULL) {
    free(path);
    napi_throw_error(env, NULL, "The Windows process addon could not allocate memory for a signature check.");
    return NULL;
  }
  check->path = path;
  if (napi_create_string_utf8(env, "verifySignatureAsync", NAPI_AUTO_LENGTH, &name) != napi_ok
      || napi_create_promise(env, &check->deferred, &promise) != napi_ok) {
    free_check(check);
    return fail(env);
  }
  if (napi_create_async_work(env, NULL, name, verify_signature_execute, verify_signature_complete, check, &check->work) != napi_ok) {
    reject(env, check->deferred);
    free_check(check);
  }
  else if (napi_queue_async_work(env, check->work) != napi_ok) {
    napi_delete_async_work(env, check->work);
    reject(env, check->deferred);
    free_check(check);
  }
  return promise;
}

NAPI_MODULE_INIT() {
  napi_property_descriptor functions[] = {
    { "listProcesses", NULL, list_processes, NULL, NULL, NULL, napi_enumerable, NULL },
    { "openProcess", NULL, open_process, NULL, NULL, NULL, napi_enumerable, NULL },
    { "readCreationTime", NULL, read_creation_time, NULL, NULL, NULL, napi_enumerable, NULL },
    { "readImagePath", NULL, read_image_path, NULL, NULL, NULL, napi_enumerable, NULL },
    { "terminateProcess", NULL, terminate_process, NULL, NULL, NULL, napi_enumerable, NULL },
    { "hasExited", NULL, has_exited, NULL, NULL, NULL, napi_enumerable, NULL },
    { "openFileForReading", NULL, open_file_for_reading, NULL, NULL, NULL, napi_enumerable, NULL },
    { "closeHandle", NULL, close_handle, NULL, NULL, NULL, napi_enumerable, NULL },
    { "verifySignatureAsync", NULL, verify_signature, NULL, NULL, NULL, napi_enumerable, NULL }
  };
  return napi_define_properties(env, exports, sizeof(functions) / sizeof(functions[0]), functions) == napi_ok ? exports : fail(env);
}
