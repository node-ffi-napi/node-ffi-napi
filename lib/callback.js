'use strict';
/**
 * Module dependencies.
 */

const ref = require('ref-napi');
const CIF = require('./cif');
const assert = require('assert');
const debug = require('debug')('ffi:Callback');
const _Callback = require('./bindings').Callback;

// Function used to report errors to the current process event loop,
// When user callback function gets gced.
function errorReportCallback (err) {
  if (err) {
    process.nextTick(function () {
      if (typeof err === 'string') {
        throw new Error(err);
      } else {
        throw err;
      }
    })
  }
}

/**
 * Turns a JavaScript function into a C function pointer.
 * The function pointer may be used in other C functions that
 * accept C callback functions.
 */

function Callback (retType, argTypes, abi, func) {
  debug('creating new Callback');

  if (typeof abi === 'function') {
    func = abi;
    abi = undefined;
  }

  // check args
  assert(!!retType, 'expected a return "type" object as the first argument');
  assert(Array.isArray(argTypes), 'expected Array of arg "type" objects as the second argument');
  assert.equal(typeof func, 'function', 'expected a function as the third argument');

  // normalize the "types" (they could be strings, so turn into real type
  // instances)
  retType = ref.coerceType(retType);
  argTypes = argTypes.map(ref.coerceType);

  // create the `ffi_cif *` instance
  const cif = CIF(retType, argTypes, abi);
  const argc = argTypes.length;

  const callback = _Callback(cif, retType.size, argc, errorReportCallback, (retval, params) => {
    debug('Callback function being invoked')
    try {
      const args = [];
      for (var i = 0; i < argc; i++) {
        const type = argTypes[i];
        const argPtr = params.readPointer(i * ref.sizeof.pointer, type.size);
        argPtr.type = type;
        args.push(argPtr.deref());
      }

      // Invoke the user-given function
      const result = func.apply(null, args);
      try {
        ref.set(retval, 0, result, retType);
      } catch (e) {
        e.message = 'error setting return value - ' + e.message;
        throw e;
      }
    } catch (e) {
      return e;
    }
  });
  
  // store reference to the CIF Buffer so that it doesn't get
  // garbage collected before the callback Buffer does
  callback._cif = cif;
  return callback;
}

module.exports = Callback;
