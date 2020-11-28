'use strict';
/**
 * Module dependencies.
 */

const DynamicLibrary = require('./dynamic_library');
const ForeignFunction = require('./foreign_function');
const VariadicForeignFunction = require('./foreign_function_var');
const debug = require('debug')('ffi:Library');
const RTLD_NOW = DynamicLibrary.FLAGS.RTLD_NOW;

/**
 * The extension to use on libraries.
 * i.e.  libm  ->  libm.so   on linux
 */

const EXT = Library.EXT = {
  'linux':  '.so',
  'linux2': '.so',
  'sunos':  '.so',
  'solaris':'.so',
  'freebsd':'.so',
  'openbsd':'.so',
  'darwin': '.dylib',
  'mac':    '.dylib',
  'win32':  '.dll'
}[process.platform];

/**
 * Provides a friendly abstraction/API on-top of DynamicLibrary and
 * ForeignFunction.
 */

function Library (libfile, funcs, lib) {
  debug('creating Library object for', libfile);

  if (libfile && typeof libfile === 'string' && libfile.indexOf(EXT) === -1) {
    debug('appending library extension to library name', EXT);
    libfile += EXT;
  }

  if (!lib) {
    lib = {};
  }
  let dl;
  if (typeof libfile === 'string' || !libfile) {
    dl = new DynamicLibrary(libfile || null, RTLD_NOW);
  } else {
    dl = libfile;
  }

  Object.keys(funcs || {}).forEach(function (func) {
    debug('defining function', func);

    const fptr = dl.get(func);
    const info = funcs[func];

    if (fptr.isNull()) {
      throw new Error('Library: "' + dl.path()
        + '" returned NULL function pointer for "' + func + '"');
    }

    const resultType = info[0];
    const paramTypes = info[1];
    const fopts = info[2];
    const abi = fopts && fopts.abi;
    const async = fopts && fopts.async;
    const varargs = fopts && fopts.varargs;

    if (varargs) {
      lib[func] = VariadicForeignFunction(fptr, resultType, paramTypes, abi);
    } else {
      const ff = ForeignFunction(fptr, resultType, paramTypes, abi);
      lib[func] = async ? ff.async : ff;
    }
  });

  return lib;
}

module.exports = Library;
