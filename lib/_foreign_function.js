'use strict';
/**
 * Module dependencies.
 */

const assert = require('assert');
const debug = require('debug')('ffi:_ForeignFunction');
const ref = require('ref-napi');
const bindings = require('./bindings');
const POINTER_SIZE = ref.sizeof.pointer;
const FFI_ARG_SIZE = bindings.FFI_ARG_SIZE;


function ForeignFunction (cif, funcPtr, returnType, argTypes) {
  debug('creating new ForeignFunction', funcPtr);

  const numArgs = argTypes.length;
  const argsArraySize = numArgs * POINTER_SIZE;

  // "result" must point to storage that is sizeof(long) or larger. For smaller
  // return value sizes, the ffi_arg or ffi_sarg integral type must be used to
  // hold the return value
  const resultSize = returnType.size >= ref.sizeof.long ? returnType.size : FFI_ARG_SIZE;
  assert(resultSize > 0);

  /**
   * This is the actual JS function that gets returned.
   * It handles marshalling input arguments into C values,
   * and unmarshalling the return value back into a JS value
   */

  const proxy = function () {
    debug('invoking proxy function');

    if (arguments.length !== numArgs) {
      throw new TypeError('Expected ' + numArgs +
          ' arguments, got ' + arguments.length);
    }

    // storage buffers for input arguments and the return value
    const result = Buffer.alloc(resultSize);
    const argsList = Buffer.alloc(argsArraySize);

    // write arguments to storage areas
    let i;
    try {
      for (i = 0; i < numArgs; i++) {
        const argType = argTypes[i];
        const val = arguments[i];
        const valPtr = ref.alloc(argType, val);
        argsList.writePointer(valPtr, i * POINTER_SIZE);
      }
    } catch (e) {
      // counting arguments from 1 is more human readable
      i++;
      e.message = 'error setting argument ' + i + ' - ' + e.message;
      throw e;
    }

    // invoke the `ffi_call()` function
    bindings.ffi_call(cif, funcPtr, result, argsList);

    result.type = returnType;
    return result.deref();
  };

  /**
   * The asynchronous version of the proxy function.
   */

  proxy.async = function () {
    debug('invoking async proxy function');

    const argc = arguments.length;
    if (argc !== numArgs + 1) {
      throw new TypeError('Expected ' + (numArgs + 1) +
          ' arguments, got ' + argc);
    }

    const callback = arguments[argc - 1];
    if (typeof callback !== 'function') {
      throw new TypeError('Expected a callback function as argument number: ' +
          (argc - 1));
    }

    // storage buffers for input arguments and the return value
    const result = Buffer.alloc(resultSize);
    const argsList = Buffer.alloc(argsArraySize);

    // write arguments to storage areas
    let i;
    try {
      for (i = 0; i < numArgs; i++) {
        const argType = argTypes[i];
        const val = arguments[i];
        const valPtr = ref.alloc(argType, val);
        argsList.writePointer(valPtr, i * POINTER_SIZE);
      }
    } catch (e) {
      e.message = 'error setting argument ' + i + ' - ' + e.message;
      return process.nextTick(callback.bind(null, e));
    }

    // invoke the `ffi_call()` function asynchronously
    bindings.ffi_call_async(cif, funcPtr, result, argsList, function (err) {
      // make sure that the 4 Buffers passed in above don't get GC'd while we're
      // doing work on the thread pool...
      [ cif, funcPtr, argsList ].map(() => {});

      // now invoke the user-provided callback function
      if (err) {
        callback(err);
      } else {
        result.type = returnType;
        callback(null, result.deref());
      }
    });
  }

  return proxy;
}

module.exports = ForeignFunction;
