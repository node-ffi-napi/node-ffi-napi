'use strict';
/**
 * Module dependencies.
 */

const CIF_var = require('./cif_var');
const Type = require('./type');
const _ForeignFunction = require('./_foreign_function');
const assert = require('assert');
const debug = require('debug')('ffi:VariadicForeignFunction');
const ref = require('ref-napi');
const bindings = require('./bindings');
const POINTER_SIZE = ref.sizeof.pointer;
const FFI_ARG_SIZE = bindings.FFI_ARG_SIZE;

/**
 * For when you want to call to a C function with variable amount of arguments.
 * i.e. `printf()`.
 *
 * This function takes care of caching and reusing ForeignFunction instances that
 * contain the same ffi_type argument signature.
 */

function VariadicForeignFunction (funcPtr, returnType, fixedArgTypes, abi) {
  debug('creating new VariadicForeignFunction', funcPtr);

  // the cache of ForeignFunction instances that this
  // VariadicForeignFunction has created so far
  const cache = {};

  // check args
  assert(Buffer.isBuffer(funcPtr), 'expected Buffer as first argument');
  assert(!!returnType, 'expected a return "type" object as the second argument');
  assert(Array.isArray(fixedArgTypes), 'expected Array of arg "type" objects as the third argument');

  const numFixedArgs = fixedArgTypes.length;

  // normalize the "types" (they could be strings,
  // so turn into real type instances)
  fixedArgTypes = fixedArgTypes.map(ref.coerceType);

  // get the names of the fixed arg types
  const fixedKey = fixedArgTypes.map(function (type) {
    return getId(type);
  });


  // what gets returned is another function that needs to be invoked with the rest
  // of the variadic types that are being invoked from the function.
  function variadic_function_generator () {
    debug('variadic_function_generator invoked');

    // first get the types of variadic args we are working with
    const argTypes = fixedArgTypes.slice();
    let key = fixedKey.slice();

    for (let i = 0; i < arguments.length; i++) {
      const type = ref.coerceType(arguments[i]);
      argTypes.push(type);

      const ffi_type = Type(type);
      assert(ffi_type.name);
      key.push(getId(type));
    }

    // now figure out the return type
    const rtnType = ref.coerceType(variadic_function_generator.returnType);
    const rtnName = getId(rtnType);
    assert(rtnName);

    // first let's generate the key and see if we got a cache-hit
    key = rtnName + key.join('');

    let func = cache[key];
    if (func) {
      debug('cache hit for key:', key);
    } else {
      // create the `ffi_cif *` instance
      debug('creating the variadic ffi_cif instance for key:', key);
      const cif = CIF_var(returnType, argTypes, numFixedArgs, abi);
      func = cache[key] = _ForeignFunction(cif, funcPtr, rtnType, argTypes);
    }
    return func;
  }

  // set the return type. we set it as a property of the function generator to
  // allow for monkey patching the return value in the very rare case where the
  // return type is variadic as well
  variadic_function_generator.returnType = returnType;

  return variadic_function_generator;
}

module.exports = VariadicForeignFunction;

const idKey = '_ffiId';
let counter = 0;
function getId (type) {
  if (!type.hasOwnProperty(idKey)) {
    type[idKey] = ((counter++*0x10000)|0).toString(16);
  }
  return type[idKey];
}
