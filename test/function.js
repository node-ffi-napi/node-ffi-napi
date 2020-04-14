'use strict';
const assert = require('assert');
const ref = require('ref-napi');
const ffi = require('../');
const bindings = require('node-gyp-build')(__dirname);

describe('Function "type"', function () {
  afterEach(global.gc);

  it('should be a function', function () {
    assert.strictEqual('function', typeof ffi.Function);
  });

  var voidFn = ffi.Function('void', []);

  it('should return a "type" object when invoked with a return type and array of arguments types', function () {
    assert(voidFn);
    assert.strictEqual('function', typeof voidFn.get);
    assert.strictEqual('function', typeof voidFn.set);
  });

  it('should be accepted as a return "type" to a ForeignFunction', function () {
    ffi.ForeignFunction(ref.NULL, voidFn, []);
  });

  it('should be accepted as an argument "type" to a ForeignFunction', function () {
    ffi.ForeignFunction(ref.NULL, 'void', [ voidFn ])
  });

  it('should work as expected using the "callback_func" static bindings', function () {
    const fn = ffi.Function('int', [ 'int' ]);
    const callback_func = ffi.ForeignFunction(bindings.callback_func, fn, [ fn ]);

    const abs = callback_func(Math.abs);
    assert.strictEqual('function', typeof abs);

    assert.strictEqual(Math.abs(-5), abs(-5));
    assert.strictEqual(Math.abs(-9), abs(-9));
    assert.strictEqual(Math.abs(-69), abs(-69));
    assert.strictEqual(Math.abs(3), abs(3));
  });
});
