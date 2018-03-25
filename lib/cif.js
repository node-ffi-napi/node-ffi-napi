'use strict';
/**
 * Module dependencies.
 */

var Type = require('./type');
const assert = require('assert');
const debug = require('debug')('ffi:cif');
const ref = require('ref-napi');
const bindings = require('./bindings');
const POINTER_SIZE = ref.sizeof.pointer;
const ffi_prep_cif = bindings.ffi_prep_cif;
const FFI_CIF_SIZE = bindings.FFI_CIF_SIZE;
const FFI_DEFAULT_ABI = bindings.FFI_DEFAULT_ABI;
  // status codes
const FFI_OK = bindings.FFI_OK;
const FFI_BAD_TYPEDEF = bindings.FFI_BAD_TYPEDEF;
const FFI_BAD_ABI = bindings.FFI_BAD_ABI;

/**
 * JS wrapper for the `ffi_prep_cif` function.
 * Returns a Buffer instance representing a `ffi_cif *` instance.
 */

const cifs = [];
function CIF (rtype, types, abi) {
  debug('creating `ffi_cif *` instance');

  // the return and arg types are expected to be coerced at this point...
  assert(!!rtype, 'expected a return "type" object as the first argument');
  assert(Array.isArray(types), 'expected an Array of arg "type" objects as the second argument');

  // the buffer that will contain the return `ffi_cif *` instance
  const cif = Buffer.alloc(FFI_CIF_SIZE);

  const numArgs = types.length;
  const _argtypesptr = Buffer.alloc(numArgs * POINTER_SIZE);
  const _rtypeptr = Type(rtype);

  for (var i = 0; i < numArgs; i++) {
    const type = types[i];
    const ffiType = Type(type);

    _argtypesptr.writePointer(ffiType, i * POINTER_SIZE);
  }

  // prevent GC of the arg type and rtn type buffers (not sure if this is required)
  cif.rtnTypePtr = _rtypeptr;
  cif.argTypesPtr = _argtypesptr;

  if (typeof abi === 'undefined') {
    debug('no ABI specified (this is OK), using FFI_DEFAULT_ABI');
    abi = FFI_DEFAULT_ABI;
  }

  const status = ffi_prep_cif(cif, numArgs, _rtypeptr, _argtypesptr, abi);

  if (status !== FFI_OK) {
    switch (status) {
      case FFI_BAD_TYPEDEF:
      {
        const err = new Error('ffi_prep_cif() returned an FFI_BAD_TYPEDEF error');
        err.code = 'FFI_BAD_TYPEDEF';
        err.errno = status;
        throw err;
      }
      case FFI_BAD_ABI:
      {
        const err = new Error('ffi_prep_cif() returned an FFI_BAD_ABI error');
        err.code = 'FFI_BAD_ABI';
        err.errno = status;
        throw err;
      }
      default:
        throw new Error('ffi_prep_cif() returned an error: ' + status);
    }
  }

  if (debug.enabled || `${process.env.DEBUG}`.match(/\bffi\b/))
    cifs.push(cif);
  return cif;
}

module.exports = CIF;
