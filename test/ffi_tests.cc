#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <napi.h>
#include <uv.h>
#include <get-uv-event-loop-napi.h>

using namespace Napi;

#undef SYMBOL_EXPORT
#ifdef _WIN32
# define SYMBOL_EXPORT __declspec(dllexport)
#else
# define SYMBOL_EXPORT __attribute__((visibility("default")))
#endif

/*
 * Exported function with C naming and calling conventions.
 * Used by dynamic_library.js to test symbol lookup.
 * Never actually called.
 */

extern "C"
int
SYMBOL_EXPORT
ExportedFunction(int value)
{
  return value * 2;
}

namespace {

/*
 * Test struct definition used in the test harness functions below.
 */

typedef struct box {
  int width;
  int height;
} _box;

/*
 * Accepts a struct by value, and returns a struct by value.
 */

box double_box(box input) {
  box rtn;
  // modify the input box, ensure on the JS side that it's not altered
  input.width *= 2;
  input.height *= 2;
  rtn.width = input.width;
  rtn.height = input.height;
  return rtn;
}

/*
 * Accepts a box struct pointer, and returns a struct by value.
 */

box double_box_ptr(box *input) {
  box rtn;
  // modify the input box, ensure on the JS side that IT IS altered
  input->width *= 2;
  input->height *= 2;
  rtn.width = input->width;
  rtn.height = input->height;
  return rtn;
}

/*
 * Accepts a struct by value, and returns an int.
 */

int area_box(box input) {
  return input.width * input.height;
}

/*
 * Accepts a box pointer and returns an int.
 */

int area_box_ptr(box *input) {
  return input->width * input->height;
}

/*
 * Creates a box and returns it by value.
 */

box create_box(int width, int height) {
  box rtn = { width, height };
  return rtn;
}

/*
 * Creates a box that has the sum of the width and height for its own values.
 */

box add_boxes(box boxes[], int num) {
  box rtn = { 0, 0 };
  box cur;
  for (int i = 0; i < num; i++) {
    cur = boxes[i];
    rtn.width += cur.width;
    rtn.height += cur.height;
  }
  return rtn;
}

/*
 * Reads "ints" from the "input" array until -1 is found.
 * Returns the number of elements in the array.
 */

int *int_array(int *input) {
  int *array = input;
  while (*array != -1){
    *array = *array * 2;
    array++;
  }
  return input;
}

/*
 * Tests for passing a Struct that contains Arrays inside of it.
 */

struct arst {
  int num;
  double array[20];
};

struct arst array_in_struct (struct arst input) {
  struct arst rtn;
  rtn.num = input.num * 2;
  for (int i = 0; i < 20; i++) {
    rtn.array[i] = input.array[i] * 3.14;
  }
  return rtn;
}

/*
 * Tests for C function pointers.
 */

typedef int (*my_callback)(int);

my_callback callback_func (my_callback cb) {
  return cb;
}

/*
 * Hard-coded `strtoul` binding, for the benchmarks.
 *
 * args[0] - the string number to convert to a real Number
 * args[1] - a "buffer" instance to write into (the "endptr")
 * args[2] - the base (0 means autodetect)
 */

Value Strtoul(const CallbackInfo& args) {
  Env env = args.Env();

  if (!args[1].IsBuffer() ||
      args[1].As<Buffer<char*>>().Length() < sizeof(char*))
    throw TypeError::New(env, "strtoul(): char* Buffer required as second arg");

  std::string str = args[0].ToString();
  int base = args[2].ToNumber().Int32Value();

  char** endptr = args[1].As<Buffer<char*>>().Data();

  unsigned long val = strtoul(str.c_str(), endptr, base);

  return Number::New(env, val);
}


// experiments for #72
typedef void (*cb)(void);

static cb callback = NULL;

void SetCb(const CallbackInfo& args) {
  callback = reinterpret_cast<cb>(args[0].As<Buffer<char>>().Data());
}

void CallCb(const CallbackInfo& args) {
  if (callback == nullptr)
    throw Error::New(args.Env(), "you must call \"set_cb()\" first");

  callback();
}

void CallCbFromThread(const CallbackInfo& args) {
  if (callback == nullptr)
    throw Error::New(args.Env(), "you must call \"set_cb()\" first");

  uv_thread_t tid;
  uv_thread_create(&tid, [](void*) {
    cb c = callback;
    if (c != nullptr)
      c();
  }, nullptr);
}

void CallCbAsync(const CallbackInfo& args) {
  if (callback == nullptr)
    throw Error::New(args.Env(), "you must call \"set_cb()\" first");

  uv_work_t* req = new uv_work_t;
  req->data = reinterpret_cast<void*>(callback);
  uv_queue_work(get_uv_event_loop(args.Env()),
                req,
                [](uv_work_t* req) {
                  reinterpret_cast<cb>(req->data)();
                },
                [](uv_work_t* req, int status) {
                  delete req;
                });
}


// Race condition in threaded callback invocation testing
// https://github.com/node-ffi/node-ffi/issues/153
void play_ping_pong (const char* (*callback) (const char*)) {
  const char* response;
  do {
    response = callback("ping");
  } while (strcmp(response, "pong") == 0);
}


// https://github.com/node-ffi/node-ffi/issues/169
int test_169(char* dst, int len) {
  const char src[] = "sample str\0";
  strncpy(dst, src, len);
  return fmin(len, strlen(src));
}


// https://github.com/TooTallNate/ref/issues/56
struct Obj56 {
  bool traceMode;
};
int test_ref_56(struct Obj56 *obj) {
  return obj->traceMode ? 1 : 0;
}


/*
 * Converts an arbitrary pointer to a node Buffer (with 0-length)
 */
template<typename T>
inline Value WrapPointer(Env env, T* ptr, size_t length = 0) {
  if (ptr == nullptr)
    length = 0;
  return Buffer<char>::New(env,
                           reinterpret_cast<char*>(ptr),
                           length,
                           [](Env,char*){});
}


Object Initialize(Env env, Object exports) {
#if WIN32
  // initialize "floating point support" on Windows?!?!
  // (this is some serious magic...)
  // http://support.microsoft.com/kb/37507
  float x = 2.3f;
#endif

  exports["atoi"] = WrapPointer(env, atoi);
  int (*absPtr)(int)(abs);
  exports["abs"] = WrapPointer(env, absPtr);
  exports["sprintf"] = WrapPointer(env, sprintf);

  // hard-coded `strtoul` binding, for the benchmarks
  exports["strtoul"] = Function::New(env, Strtoul);
  exports["set_cb"] = Function::New(env, SetCb);
  exports["call_cb"] = Function::New(env, CallCb);
  exports["call_cb_from_thread"] = Function::New(env, CallCbFromThread);
  exports["call_cb_async"] = Function::New(env, CallCbAsync);

  // also need to test these custom functions
  exports["double_box"] = WrapPointer(env, double_box);
  exports["double_box_ptr"] = WrapPointer(env, double_box_ptr);
  exports["area_box"] = WrapPointer(env, area_box);
  exports["area_box_ptr"] = WrapPointer(env, area_box_ptr);
  exports["create_box"] = WrapPointer(env, create_box);
  exports["add_boxes"] = WrapPointer(env, add_boxes);
  exports["int_array"] = WrapPointer(env, int_array);
  exports["array_in_struct"] = WrapPointer(env, array_in_struct);
  exports["callback_func"] = WrapPointer(env, callback_func);
  exports["play_ping_pong"] = WrapPointer(env, play_ping_pong);
  exports["test_169"] = WrapPointer(env, test_169);
  exports["test_ref_56"] = WrapPointer(env, test_ref_56);

  return exports;
}

} // anonymous namespace

NODE_API_MODULE(ffi_tests, Initialize)
