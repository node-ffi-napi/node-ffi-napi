'use strict';
const assert = require('assert');
const ref = require('ref-napi');
const Struct = require('ref-struct-di')(ref);
const ffi = require('../');
const DynamicLibrary = ffi.DynamicLibrary;
const Library = ffi.Library;

describe('Library', function () {
  const charPtr = ref.refType(ref.types.char);

  afterEach(global.gc);

  it('should be a function', function () {
    assert(typeof Library === 'function');
  });

  it('should work with the `new` operator', function () {
    const l = new Library();
    assert(typeof l === 'object');
  });

  it('should accept `null` as a first argument', function () {
    if (process.platform == 'win32') {
      // On Windows, null refers to just the main executable (e.g. node.exe).
      // Windows never searches for symbols across multiple DLL's.
      // Note: Exporting symbols from an executable is unusual on Windows.
      // Normally you only see exports from DLL's. It happens that node.exe
      // does export symbols, so null as a first argument can be tested.
      // This is an implementation detail of node, and could potentially
      // change in the future (e.g. if node gets broken up into DLL's
      // rather than being one large static linked executable).
      const winFuncs = new Library(null, {
        'uv_fs_open': [ 'void', [ charPtr ] ]
      });
      assert(typeof winFuncs.uv_fs_open === 'function');
    } else {
      // On POSIX, null refers to the global symbol table, and lets you use
      // symbols in the main executable and loaded shared libaries.
      const posixFuncs = new Library(null, {
        'printf': [ 'void', [ charPtr ] ]
      });
      assert(typeof posixFuncs.printf === 'function');
    }
  });

  it('should accept a lib name as the first argument', function () {
    const lib = process.platform == 'win32' ? 'msvcrt' : 'libm';
    const libm = new Library(lib, {
        'ceil': [ 'double', [ 'double' ] ]
    });
    assert(typeof libm.ceil === 'function');
    assert(libm.ceil(1.1) === 2);
  })

  it('should accept a DynamicLibrary instance as the first argument', function () {
    const lib = process.platform == 'win32' ? 'msvcrt' : 'libm';
    const libm = new Library(new DynamicLibrary(lib + ffi.LIB_EXT, DynamicLibrary.FLAGS.RTLD_NOW), {
        'ceil': [ 'double', [ 'double' ] ]
    });
    assert(typeof libm.ceil === 'function');
    assert(libm.ceil(1.1) === 2);
  })

  it('should accept a lib name with file extension', function() {
    const lib = process.platform == 'win32'
      ? 'msvcrt.dll'
      : 'libm' + ffi.LIB_EXT;
    const libm = new Library(lib, {
      'ceil': [ 'double', ['double'] ]
    });
    assert(typeof libm.ceil === 'function');
    assert(libm.ceil(100.9) === 101);
  })

  it('should throw when an invalid function name is used', function () {
    try {
      new Library(null, {
          'doesnotexist__': [ 'void', [] ]
      });
      assert(false); // unreachable
    } catch (e) {
      assert(e);
    }
  })

  it('should work with "strcpy" and a 128 length string', function () {
    const lib = process.platform == 'win32' ? 'msvcrt.dll' : null;
    const ZEROS_128 = Array(128 + 1).join('0');
    const buf = new Buffer(256);
    const strcpy = new Library(lib, {
        'strcpy': [ charPtr, [ charPtr, 'string' ] ]
    }).strcpy;
    strcpy(buf, ZEROS_128);
    assert(buf.readCString() === ZEROS_128);
  })

  it('should work with "strcpy" and a 2k length string', function () {
    const lib = process.platform == 'win32' ? 'msvcrt' : null;
    const ZEROS_2K = Array(2e3 + 1).join('0');
    const buf = new Buffer(4096);
    const strcpy = new Library(lib, {
      'strcpy': [ charPtr, [ charPtr, 'string' ] ]
    }).strcpy;
    strcpy(buf, ZEROS_2K);
    assert(buf.readCString() === ZEROS_2K);
  })

  if (process.platform == 'win32') {

    it('should work with "GetTimeOfDay" and a "FILETIME" Struct pointer', () => {
      const FILETIME = new Struct({
        dwLowDateTime: ref.types.uint32,
        dwHighDateTime: ref.types.uint32
      })
      const l = new Library('kernel32', {
        'GetSystemTimeAsFileTime': [ 'void', [ 'pointer' ]]
      });
      const ft = new FILETIME();
      l.GetSystemTimeAsFileTime(ft.ref());
      // TODO: Add an assert clause here...
    });

  } else {

    it('should work with "gettimeofday" and a "timeval" Struct pointer', () => {
      const timeval = new Struct({
        tv_sec: ref.types.long,
        tv_usec: ref.types.long
      });
      const timevalPtr = ref.refType(timeval);
      const timezonePtr = ref.refType(ref.types.void);
      const l = new Library(null, {
        gettimeofday: [ref.types.int, [timevalPtr, timezonePtr]]
      });
      const tv = new timeval();
      l.gettimeofday(tv.ref(), null);
      assert.strictEqual(Math.floor(Date.now() / 1000), tv.tv_sec);
    });
  }

  describe('async', function () {
    it('should call a function asynchronously', function (done) {
      const lib = process.platform == 'win32' ? 'msvcrt' : 'libm';
      const libm = new Library(lib, {
          ceil: [ 'double', [ 'double' ], { async: true } ]
      });
      libm.ceil(1.1, function (err, res) {
        assert(err === null);
        assert(res === 2);
        done();
      });
    });
  });
});
