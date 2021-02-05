#include <uv.h>
#include <napi.h>

#include <limits.h>
#include <errno.h>
#ifndef __STDC_LIMIT_MACROS
#define __STDC_LIMIT_MACROS true
#endif
#include <stdint.h>
#include <queue>
#include <memory>
#include <unordered_map>

#ifdef WIN32
#include "win32-dlfcn.h"
#else
#include <dlfcn.h>
#endif

#include "ref-napi.h"

/* define FFI_BUILDING before including ffi.h because this is a static build */
#define FFI_BUILDING
#include <ffi.h>

#define FFI_ASYNC_ERROR static_cast<ffi_status>(1)

namespace FFI {

using namespace Napi;

class InstanceData;

/*
 * Class used to store stuff during async ffi_call() invokations.
 */

class AsyncCallParams {
  public:
    explicit AsyncCallParams(Env env_) : env(env_) {}
    Env env;
    ffi_status result;
    std::string err;
    ffi_cif* cif;
    char* fn;
    char* res;
    void** argv;
    FunctionReference callback;
    uv_work_t req;
};

class FFI {
  public:
    static Object InitializeStaticFunctions(Env env);
    static void InitializeBindings(Env env, Object target);

  protected:
    static Value FFIPrepCif(const Napi::CallbackInfo& args);
    static Value FFIPrepCifVar(const Napi::CallbackInfo& args);
    static void FFICall(const Napi::CallbackInfo& args);
    static void FFICallAsync(const Napi::CallbackInfo& args);
    static void AsyncFFICall(uv_work_t* req);
    static void FinishAsyncFFICall(uv_work_t* req, int status);
};

/*
 * One of these structs gets created for each `ffi.Callback()` invokation in
 * JavaScript-land. It contains all the necessary information when invoking the
 * pointer to proxy back to JS-land properly. It gets created by
 * `ffi_closure_alloc()`, and free'd in the closure_pointer_cb function.
 */

struct callback_info {
  callback_info() {
  }

  ffi_closure closure;           // the actual `ffi_closure` instance get inlined
  void* code;                    // the executable function pointer
  FunctionReference errorFunction;    // JS callback function for reporting caught exceptions for the process' event loop
  FunctionReference function;         // JS callback function the closure represents
  // these two are required for creating proper sized WrapPointer buffer instances
  int argc;                      // the number of arguments this function expects
  size_t resultSize;             // the size of the result pointer
  InstanceData* instance_data;
};

class ThreadedCallbackInvokation;

class CallbackInfo {
  public:
    static Function Initialize(Env env);
    static void WatcherCallback(uv_async_t* w);

  protected:
    static void DispatchToV8(callback_info* self, void* retval, void** parameters, bool dispatched = false);
    static void Invoke(ffi_cif* cif, void* retval, void** parameters, void* user_data);
    static Value Callback(const Napi::CallbackInfo& info);
};

/**
 *   Synchronization object to ensure following order of execution:
 *   -> WaitForExecution()     invoked
 *   -> SignalDoneExecuting()  returned
 *   -> WaitForExecution()     returned
 *
 *   ^WaitForExecution() must always be called from the thread which owns the object
 */

class ThreadedCallbackInvokation {
  public:
    ThreadedCallbackInvokation(callback_info* cbinfo, void* retval, void** parameters);
    ~ThreadedCallbackInvokation();

    void SignalDoneExecuting();
    void WaitForExecution();

    void* m_retval;
    void** m_parameters;
    callback_info* m_cbinfo;

  private:
    uv_cond_t m_cond;
    uv_mutex_t m_mutex;
};

class InstanceData final {
 public:
  explicit InstanceData(Env env_) : env(env_) {}

  Env env;
  RefNapi::Instance* ref_napi_instance = nullptr;

  void Dispose();

#ifdef WIN32
  DWORD thread;
#else
  uv_thread_t thread;
#endif
  uv_mutex_t mutex;
  std::queue<ThreadedCallbackInvokation*> queue;
  uv_async_t async;

  static InstanceData* Get(Env env);
};

TypedArray WrapPointerImpl(Env env, char* ptr, size_t length);
char* GetBufferDataImpl(Value val);

template <typename T>
inline TypedArray WrapPointer(Env env, T* ptr, size_t length = 0) {
  return WrapPointerImpl(env, reinterpret_cast<char*>(ptr), length);
}

template <typename T>
inline T* GetBufferData(Value val) {
  return reinterpret_cast<T*>(GetBufferDataImpl(val));
}

}
