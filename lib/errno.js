'use strict';
const DynamicLibrary = require('./dynamic_library');
const ForeignFunction = require('./foreign_function');
const bindings = require('./bindings');
const funcs = bindings.StaticFunctions;
const ref = require('ref-napi');
const int = ref.types.int;
const intPtr = ref.refType(int);
let errno = null;

if (process.platform == 'win32') {
  const _errno = DynamicLibrary('msvcrt.dll').get('_errno');
  const errnoPtr = ForeignFunction(_errno, intPtr, []);
  errno = function() {
    return errnoPtr().deref();
  };
} else {
  errno = ForeignFunction(funcs._errno, 'int', []);
}

module.exports = errno;
