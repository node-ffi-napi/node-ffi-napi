'use strict';
const assert = require('assert');
const ref = require('ref-napi');
const ffi = require('../');
const errno = ffi.errno;

describe('errno()', function () {
  afterEach(global.gc);

  it('should be a function', function () {
    assert.strictEqual('function', typeof errno);
  });

  it('should set the errno with out-of-range "strtoul" value', function () {
    const lib = process.platform == 'win32' ? 'msvcrt' : 'libc';
    const strtoul = new ffi.Library(lib, {
      'strtoul': [ 'ulong', [ 'string', 'string', 'int' ] ]
    }).strtoul;
    strtoul('1234567890123456789012345678901234567890', null, 0);
    assert.strictEqual(34, errno()); // errno == ERANGE
  });
});
