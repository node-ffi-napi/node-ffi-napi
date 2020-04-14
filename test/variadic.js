'use strict';
const assert = require('assert');
const ref = require('ref-napi');
const ffi = require('../');
const bindings = require('node-gyp-build')(__dirname);
const sprintfPtr = bindings.sprintf;

describe('variadic arguments', function () {
  afterEach(global.gc);

  it('should work with vararg C functions', function () {
    const buf = new Buffer(100);
    const sprintfGen = ffi.VariadicForeignFunction(sprintfPtr, 'int', [ 'pointer', 'string' ]);

    sprintfGen()(buf, 'hello world!');
    assert.strictEqual(buf.readCString(), 'hello world!');

    sprintfGen('int')(buf, '%d', 42);
    assert.strictEqual(buf.readCString(), '42');

    sprintfGen('double')(buf, '%10.2f', 3.14);
    assert.strictEqual(buf.readCString(), '      3.14');

    sprintfGen('string')(buf, ' %s ', 'test');
    assert.strictEqual(buf.readCString(), ' test ');
  });

  it('should return the same Function instance when the same arguments are used', function () {
    var sprintfGen = ffi.VariadicForeignFunction(sprintfPtr, 'int', [ 'pointer', 'string' ]);

    var one = sprintfGen('int');
    var two = sprintfGen(ref.types.int);

    assert.strictEqual(one, two);
  });
});
