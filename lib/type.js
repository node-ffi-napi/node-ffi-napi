'use strict';
/**
 * Module dependencies.
 */

const ref = require('ref-napi');
const assert = require('assert');
const debug = require('debug')('ffi:types');
const Struct = require('ref-struct-di')(ref);
const bindings = require('./bindings');

/**
 * Define the `ffi_type` struct (see deps/libffi/include/ffi.h) for use in JS.
 * This struct type is used internally to define custom struct ret/arg types.
 */

const FFI_TYPE = Type.FFI_TYPE = Struct();
FFI_TYPE.defineProperty('size',      ref.types.size_t);
FFI_TYPE.defineProperty('alignment', ref.types.ushort);
FFI_TYPE.defineProperty('type',      ref.types.ushort);
// this last prop is a C Array of `ffi_type *` elements, so this is `ffi_type **`
const ffi_type_ptr_array = ref.refType(ref.refType(FFI_TYPE));
FFI_TYPE.defineProperty('elements',  ffi_type_ptr_array);
assert.strictEqual(bindings.FFI_TYPE_SIZE, FFI_TYPE.size);

/**
 * Returns a `ffi_type *` Buffer appropriate for the given "type".
 *
 * @param {Type|String} type A "ref" type (or string) to get the `ffi_type` for
 * @return {Buffer} A buffer pointing to a `ffi_type` instance for "type"
 * @api private
 */

function Type (type) {
  type = ref.coerceType(type);
  debug('Type()', type.name || type);
  assert(type.indirection >= 1, 'invalid "type" given: ' + (type.name || type));
  let ret;

  // first we assume it's a regular "type". if the "indirection" is greater than
  // 1, then we can just use "pointer" ffi_type, otherwise we hope "ffi_type" is
  // set
  if (type.indirection === 1) {
    ret = type.ffi_type;
  } else {
    ret = bindings.FFI_TYPES.pointer;
  }

  // if "ret" isn't set (ffi_type was not set) then we check for "ref-array" type
  if (!ret && type.type) {
    // got a "ref-array" type
    // passing arrays to C functions are always by reference, so we use "pointer"
    ret = bindings.FFI_TYPES.pointer;
  }

  if (!ret && type.fields) {
    // got a "ref-struct" type
    // need to create the `ffi_type` instance manually
    debug('creating an `ffi_type` for given "ref-struct" type')
    const fields = type.fields;
    const fieldNames = Object.keys(fields);
    const numFields = fieldNames.length;
    let numElements = 0;
    const ffi_type = new FFI_TYPE;
    let field;
    let ffi_type_ptr;

    // these are the "ffi_type" values expected for a struct
    ffi_type.size = 0;
    ffi_type.alignment = 0;
    ffi_type.type = 13; // FFI_TYPE_STRUCT

    // first we have to figure out the number of "elements" that will go in the
    // array. this would normally just be "numFields" but we also have to account
    // for arrays, which each act as their own element
    for (let i = 0; i < numFields; i++) {
      field = fields[fieldNames[i]];
      if (field.type.fixedLength > 0) {
        // a fixed-length "ref-array" type
        numElements += field.type.fixedLength;
      } else {
        numElements += 1;
      }
    }

    // hand-crafting a null-terminated array here.
    // XXX: use "ref-array"?
    const size = ref.sizeof.pointer * (numElements + 1); // +1 because of the NULL terminator
    const elements = ffi_type.elements = Buffer.alloc(size);
    let index = 0;
    for (let i = 0; i < numFields; i++) {
      field = fields[fieldNames[i]];
      if (field.type.fixedLength > 0) {
        // a fixed-length "ref-array" type
        ffi_type_ptr = Type(field.type.type);
        for (var j = 0; j < field.type.fixedLength; j++) {
          elements.writePointer(ffi_type_ptr, (index++) * ref.sizeof.pointer);
        }
      } else {
        ffi_type_ptr = Type(field.type);
        elements.writePointer(ffi_type_ptr, (index++) * ref.sizeof.pointer);
      }
    }
    // final NULL pointer to terminate the Array
    elements.writePointer(ref.NULL, index * ref.sizeof.pointer);
    // also set the `ffi_type` property to that it's cached for next time
    ret = type.ffi_type = ffi_type.ref();
  }

  if (!ret && type.name) {
    // handle "ref" types other than the set that node-ffi is using (i.e.
    // a separate copy)
    if ('CString' == type.name) {
      ret = type.ffi_type = bindings.FFI_TYPES.pointer;
    } else {
      let cur = type;
      while (!ret && cur) {
        ret = cur.ffi_type = bindings.FFI_TYPES[cur.name];
        cur = Object.getPrototypeOf(cur);
      }
    }
  }

  assert(ret, 'Could not determine the `ffi_type` instance for type: ' + (type.name || type))
  debug('returning `ffi_type`', ret.name)
  return ret;
}

module.exports = Type;
