'use strict';
const assert = require('assert');
const ref = require('ref-napi');
const Array = require('ref-array-di')(ref);
const Struct = require('ref-struct-di')(ref);
const ffi = require('../');
const bindings = require('node-gyp-build')(__dirname);

describe('ForeignFunction', function () {
  afterEach(global.gc);

  // these structs are also defined in ffi_tests.cc
  const box = Struct({
    width: ref.types.int,
    height: ref.types.int
  });

  const arst = Struct({
    num: 'int',
    array: Array('double', 20)
  });

  it('should call the static "abs" bindings', function () {
    const _abs = bindings.abs;
    const abs = ffi.ForeignFunction(_abs, 'int', [ 'int' ]);
    assert.strictEqual('function', typeof abs);
    assert.strictEqual(1234, abs(-1234));
  })

  it('should throw an Error with a meaningful message when type\'s `set()` throws', function () {
    const _abs = bindings.abs;
    const abs = ffi.ForeignFunction(_abs, 'int', [ 'int' ]);
    assert.throws(function () {
      // Changed, because returning string is not failing because of this; https://github.com/iojs/io.js/issues/1161
      abs(11111111111111111111);
    }, /error setting argument 1/);
  });

  it('should call the static "atoi" bindings', function () {
    const _atoi = bindings.atoi;
    const atoi = ffi.ForeignFunction(_atoi, 'int', [ 'string' ]);
    assert.strictEqual('function', typeof atoi);
    assert.strictEqual(1234, atoi('1234'));
  });

  it('should call the static "double_box" bindings', function () {
    const double_box = ffi.ForeignFunction(bindings.double_box, box, [ box ]);
    const b = new box;
    assert(b instanceof box);
    b.width = 4;
    b.height = 5;
    const out = double_box(b);
    // double_box writes to its input "box" struct, so make sure that the one we
    // passed in remains unaffected (since we passed it in by value, not pointer)
    assert.strictEqual(4, b.width);
    assert.strictEqual(5, b.height);
    assert(out instanceof box);
    assert.strictEqual(8, out.width);
    assert.strictEqual(10, out.height);
    assert.notStrictEqual(b.ref().address(), out.ref().address());
  });

  it('should call the static "double_box_ptr" bindings', function () {
    const boxPtr = ref.refType(box);
    const double_box_ptr = ffi.ForeignFunction(bindings.double_box_ptr, box, [ boxPtr ]);
    const b = new box;
    b.width = 4;
    b.height = 5;
    const out = double_box_ptr(b.ref());
    // double_box_ptr writes to its input "box" struct, so make sure that the one
    // we passed in has it's values changed (since we passed it in by pointer)
    assert.strictEqual(8, b.width);
    assert.strictEqual(10, b.height);
    assert(out instanceof box);
    assert.strictEqual(8, out.width);
    assert.strictEqual(10, out.height);
    assert.notStrictEqual(b.ref().address(), out.ref().address());
  });

  it('should call the static "area_box" bindings', function () {
    const area_box = ffi.ForeignFunction(bindings.area_box, ref.types.int, [ box ]);
    const b = new box({ width: 5, height: 20 });
    const rtn = area_box(b);
    assert.strictEqual('number', typeof rtn);
    assert.strictEqual(100, rtn);
  });

  it('should call the static "area_box_ptr" bindings', function () {
    const boxPtr = ref.refType(box);
    const area_box = ffi.ForeignFunction(bindings.area_box_ptr, ref.types.int, [ boxPtr ]);
    const b = new box({ width: 5, height: 20 });
    const rtn = area_box(b.ref());
    assert.strictEqual('number', typeof rtn);
    assert.strictEqual(100, rtn);
  });

  it('should call the static "create_box" bindings', function () {
    const create_box = ffi.ForeignFunction(bindings.create_box, box, [ 'int', 'int' ]);
    const rtn = create_box(1, 2);
    assert(rtn instanceof box);
    assert.strictEqual(1, rtn.width);
    assert.strictEqual(2, rtn.height);
  });

  it('should call the static "add_boxes" bindings', function () {
    const count = 3;
    const boxes = new Buffer(box.size * count);
    box.set(boxes, box.size * 0, { width: 1, height: 10 });
    box.set(boxes, box.size * 1, { width: 2, height: 20 });
    box.set(boxes, box.size * 2, { width: 3, height: 30 });
    const boxPtr = ref.refType(box);
    const add_boxes = ffi.ForeignFunction(bindings.add_boxes, box, [ boxPtr, 'int' ]);
    const rtn = add_boxes(boxes, count);
    assert(rtn instanceof box);
    assert.strictEqual(6, rtn.width);
    assert.strictEqual(60, rtn.height);
  });

  it('should call the static "int_array" bindings', function () {
    const IntArray = Array('int');
    const int_array = ffi.ForeignFunction(bindings.int_array, IntArray, [ IntArray ]);
    const array = new IntArray([ 1, 2, 3, 4, 5, -1 ]);
    const out = int_array(array);
    out.length = array.length;
    assert.strictEqual(2, out[0]);
    assert.strictEqual(4, out[1]);
    assert.strictEqual(6, out[2]);
    assert.strictEqual(8, out[3]);
    assert.strictEqual(10, out[4]);
    assert.strictEqual(-1, out[5]);
  });

  it('should call the static "array_in_struct" bindings', function () {
    const array_in_struct = ffi.ForeignFunction(bindings.array_in_struct, arst, [ arst ]);
    const a = new arst;
    assert.strictEqual(20, a.array.length);
    a.num = 69;
    for (let i = 0; i < 20; i++) {
      a.array[i] = i / 3.14;
    }

    const b = array_in_struct(a);
    assert(b instanceof arst);
    assert.strictEqual(138, b.num);
    assert.strictEqual(20, b.array.length);
    for (let i = 0; i < 20; i++) {
      // Math.round() because of floating point rounding erros
      assert.strictEqual(i, Math.round(b.array[i]));
    }
  });

  // allow a Buffer backing store to be used as a "string" FFI argument
  // https://github.com/node-ffi/node-ffi/issues/169
  it('should call the static "test_169" bindings', function () {
    const test = ffi.ForeignFunction(bindings.test_169, 'int', [ 'string', 'int' ]);
    const b = new Buffer(20);
    const len = test(b, b.length);
    assert.strictEqual('sample str', b.toString('ascii', 0, len));
  });

  // testing `bool` ref type
  // https://github.com/TooTallNate/ref/issues/56
  it('should call the static "test_169" bindings', function () {
    const Obj56 = Struct({
      'traceMode': ref.types.bool
    });
    const t = new Obj56({ traceMode: true });
    const f = new Obj56({ traceMode: false });

    const test = ffi.ForeignFunction(bindings.test_ref_56, 'int', [ ref.refType(Obj56) ]);

    assert.strictEqual(1, test(t.ref()));
    assert.strictEqual(0, test(f.ref()));
  });

  it('should not call the "ref()" function of its arguments', function () {
    const void_ptr_arg = ffi.ForeignFunction(bindings.abs, 'void *', [ 'void *' ]);
    const b = new Buffer(0);
    b.ref = assert.bind(null, 0, '"ref()" should not be called');
    void_ptr_arg(b);
  });

  describe('async', function () {
    it('should call the static "abs" bindings asynchronously', function (done) {
      const _abs = bindings.abs;
      const abs = ffi.ForeignFunction(_abs, 'int', [ 'int' ]);
      assert.strictEqual('function', typeof abs.async);

      // invoke asynchronously
      abs.async(-1234, function (err, res) {
        assert.strictEqual(null, err);
        assert.strictEqual(1234, res);
        done();
      });
    });

    it('should invoke the callback with an Error with a meaningful message when type\'s `set()` throws', function (done) {
      const _abs = bindings.abs;
      const abs = ffi.ForeignFunction(_abs, 'int', [ 'int' ]);

      // Changed, because returning string is not failing because of this; https://github.com/iojs/io.js/issues/1161
      abs.async(1111111111111111111111, function (err, res) {
        try {
          assert(err);
          assert(/error setting argument 0/.test(err.message));
          assert.strictEqual('undefined', typeof res);
          done();
        }
        catch (e) {
          done(e);
        }
      });
    });
  });
});
