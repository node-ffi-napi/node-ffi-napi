'use strict';
const assert = require('assert');
const path = require('path');
const ref = require('ref-napi');
const ffi = require('../');
const fs = require('fs-extra');
const DynamicLibrary = ffi.DynamicLibrary;

describe('DynamicLibrary', function () {
  it('should be a function', function () {
    assert.strictEqual('function', typeof DynamicLibrary);
  });

  it('should return a "DynamicLibrary" instance when invoked', function () {
    const lib = process.platform == 'win32' ? 'msvcrt' : 'libc';
    const handle = DynamicLibrary(lib + ffi.LIB_EXT);
    assert(handle instanceof DynamicLibrary);
  });

  describe('get()', function () {
    it('should return a "pointer" Buffer to a symbol', function () {
      const lib = process.platform == 'win32' ? 'msvcrt' : 'libc';
      const handle = DynamicLibrary(lib + ffi.LIB_EXT);
      const symbol = handle.get('free');
      assert(Buffer.isBuffer(symbol));
      assert.strictEqual(0, symbol.length);
    });

    it('should set the "name" property to the name of the symbol', function () {
      const lib = process.platform == 'win32' ? 'msvcrt' : 'libc';
      const handle = DynamicLibrary(lib + ffi.LIB_EXT);
      const name = 'free';
      const symbol = handle.get(name);
      assert.strictEqual(name, symbol.name);
    });

    it('should load libraries when pathname contains unicode characters', function() {
      // Directory and file names are "I can't read this" and "Or this"
      // translated into Simplified Chinese by Google Translate
      let lib, t;
      for (t of ['Debug', 'Release']) {
        lib = path.join(__dirname, 'build', t, 'ffi_tests.node'); // .node file is just a dynamic library
        if (fs.existsSync(lib)) break;
      }
      const toDir = path.join(__dirname, 'build', t, String.fromCharCode(0x6211, 0x65e0, 0x6cd5, 0x9605, 0x8bfb));
      const toLib = path.join(toDir, String.fromCharCode(0x6216, 0x8005, 0x8fd9) + '.node');
      fs.mkdirsSync(toDir);
      fs.copySync(lib, toLib);
      const handle = DynamicLibrary(toLib);
      const name = 'ExportedFunction';
      const symbol = handle.get(name);
      assert.strictEqual(name, symbol.name);
    });
  });
});
