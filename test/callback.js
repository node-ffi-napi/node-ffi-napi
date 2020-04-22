'use strict';
const assert = require('assert');
const ref = require('ref-napi');
const ffi = require('../');
const int = ref.types.int;
const bindings = require('node-gyp-build')(__dirname);

describe('Callback', function () {
  afterEach(global.gc);

  it('should create a C function pointer from a JS function', function () {
    const callback = ffi.Callback('void', [ ], function (val) { });
    assert(Buffer.isBuffer(callback));
  });

  it('should be invokable by an ffi\'d ForeignFunction', function () {
    const funcPtr = ffi.Callback(int, [ int ], Math.abs);
    const func = ffi.ForeignFunction(funcPtr, int, [ int ]);
    assert.strictEqual(1234, func(-1234));
  });

  it('should work with a "void" return type', function () {
    const funcPtr = ffi.Callback('void', [ ], function (val) { });
    const func = ffi.ForeignFunction(funcPtr, 'void', [ ]);
    assert.strictEqual(null, func());
  });

  it('should not call "set()" of a pointer type', function () {
    const voidType = Object.create(ref.types.void);
    voidType.get = function () {
      throw new Error('"get()" should not be called');
    };
    voidType.set = function () {
      throw new Error('"set()" should not be called');
    };
    const voidPtr = ref.refType(voidType);
    let called = false;
    const cb = ffi.Callback(voidPtr, [ voidPtr ], function (ptr) {
      called = true;
      assert.strictEqual(0, ptr.address());
      return ptr;
    })

    const fn = ffi.ForeignFunction(cb, voidPtr, [ voidPtr ]);
    assert(!called);
    const nul = fn(ref.NULL);
    assert(called);
    assert(Buffer.isBuffer(nul));
    assert.strictEqual(0, nul.address());
  });

  it('should throw an Error when invoked through a ForeignFunction and throws', function () {
    const cb = ffi.Callback('void', [ ], function () {
      throw new Error('callback threw')
    });
    const fn = ffi.ForeignFunction(cb, 'void', [ ]);
    assert.throws(function () {
      fn();
    }, /callback threw/);
  });

  it('should throw an Error with a meaningful message when a type\'s "set()" throws', function () {
    const cb = ffi.Callback('int', [ ], function () {
      // Changed, because returning string is not failing because of this
      // https://github.com/iojs/io.js/issues/1161
      return 1111111111111111111111;
    });
    const fn = ffi.ForeignFunction(cb, 'int', [ ]);
    assert.throws(function () {
      fn();
    }, /error setting return value/);
  });

  it('should throw an Error when invoked after the callback gets garbage collected', function (done) {
    return this.skip('this test is inherently broken');
    let cb = ffi.Callback('void', [ ], function () { });

    // register the callback function
    bindings.set_cb(cb);

    // should be ok
    bindings.call_cb();

    cb = null; // Free the object for GC
    global.gc();

    setImmediate(() => {
      // should throw an Error synchronously
      assert.throws(() => {
        bindings.call_cb();
      }, /callback has been garbage collected/);
      done();
    });
  });

  /**
   * We should make sure that callbacks or errors gets propagated back to node's main thread
   * when it called on a non libuv native thread.
   * See: https://github.com/node-ffi/node-ffi/issues/199
   */

  it("should propagate callbacks and errors back from native threads", function(done) {
    let invokeCount = 0;
    let cb = ffi.Callback('void', [ ], function () {
      invokeCount++;
    });

    const kill = (cb => {
      // register the callback function
      bindings.set_cb(cb);
      return function () {
        cb = null;
      }
    })(cb);

    // destroy the outer "cb". now "kill()" holds the "cb" reference
    cb = null;

    // invoke the callback a couple times
    assert.strictEqual(0, invokeCount);
    bindings.call_cb_from_thread();
    bindings.call_cb_from_thread();

    setTimeout(function () {
      assert.strictEqual(2, invokeCount);

      global.gc(); // ensure the outer "cb" Buffer is collected
      process.nextTick(finish);
    }, 100);

    function finish () {
      return done(); // This test is inherently broken.
      kill();
      global.gc(); // now ensure the inner "cb" Buffer is collected

      // should throw an Error asynchronously!,
      // because the callback has been garbage collected.

      // hijack the "uncaughtException" event for this test
      const listeners = process.listeners('uncaughtException').slice();
      process.removeAllListeners('uncaughtException');
      process.once('uncaughtException', function (e) {
        let err;
        try {
          assert(/ffi/.test(e.message));
        } catch (ae) {
          err = ae;
        }
        done(err);

        listeners.forEach(function (fn) {
          process.on('uncaughtException', fn);
        });
      });

      bindings.call_cb_from_thread();
    }
  });

  describe('async', function () {
    it('should be invokable asynchronously by an ffi\'d ForeignFunction', function (done) {
      const funcPtr = ffi.Callback(int, [ int ], Math.abs);
      const func = ffi.ForeignFunction(funcPtr, int, [ int ]);
      func.async(-9999, function (err, res) {
        assert.strictEqual(null, err);
        assert.strictEqual(9999, res);
        process.nextTick(done);
      });
    });

    /**
     * See https://github.com/rbranson/node-ffi/issues/153.
     */

    it('multiple callback invocations from uv thread pool should be properly synchronized', function (done) {
      this.timeout(10000)
      let iterations = 30000;
      let cb = ffi.Callback('string', [ 'string' ], function (val) {
        if (val === "ping" && --iterations > 0) {
          return "pong";
        }
        return "end";
      })
      const pingPongFn = ffi.ForeignFunction(bindings.play_ping_pong, 'void', [ 'pointer' ]);
      pingPongFn.async(cb, function (err, ret) {
        assert.strictEqual(iterations, 0);
        done();
      });
    });

    /**
     * See https://github.com/rbranson/node-ffi/issues/72.
     * This is a tough issue. If we pass the ffi_closure Buffer to some foreign
     * C function, we really don't know *when* it's safe to dispose of the Buffer,
     * so it's left up to the developer.
     *
     * In this case, we wrap the responsibility in a simple "kill()" function
     * that, when called, destroys of its references to the ffi_closure Buffer.
     */

    it('should work being invoked multiple times', function (done) {
      let invokeCount = 0;
      let cb = ffi.Callback('void', [ ], function () {
        invokeCount++;
      });

      const kill = (function (cb) {
        // register the callback function
        bindings.set_cb(cb);
        return function () {
          cb = null;
        }
      })(cb);

      // destroy the outer "cb". now "kill()" holds the "cb" reference
      cb = null;

      // invoke the callback a couple times
      assert.strictEqual(0, invokeCount);
      bindings.call_cb();
      assert.strictEqual(1, invokeCount);
      bindings.call_cb();
      assert.strictEqual(2, invokeCount);

      setTimeout(function () {
        // invoke it once more for shits and giggles
        bindings.call_cb();
        assert.strictEqual(3, invokeCount);

        global.gc(); // ensure the outer "cb" Buffer is collected
        process.nextTick(finish);
      }, 25);

      function finish () {
        return done(); // This test is inherently broken.
        bindings.call_cb();
        assert.strictEqual(4, invokeCount);

        kill();
        global.gc(); // now ensure the inner "cb" Buffer is collected

        // should throw an Error synchronously
        try {
          bindings.call_cb();
          assert(false); // shouldn't get here
        } catch (e) {
          assert(/ffi/.test(e.message));
        }

        done();
      }
    })

    it('should throw an Error when invoked after the callback gets garbage collected', function (done) {
      let cb = ffi.Callback('void', [ ], function () { });

      // register the callback function
      bindings.set_cb(cb);

      // should be ok
      bindings.call_cb();

      // hijack the "uncaughtException" event for this test
      const listeners = process.listeners('uncaughtException').slice();
      process.removeAllListeners('uncaughtException');
      process.once('uncaughtException', function (e) {
        let err;
        try {
          assert(/ffi/.test(e.message));
        } catch (ae) {
          err = ae;
        }
        done(err);

        listeners.forEach(function (fn) {
          process.on('uncaughtException', fn);
        });
      });

      cb = null;
      global.gc();
      return done(); // This test is inherently broken.

      // should generate an "uncaughtException" asynchronously
      bindings.call_cb_async();
    });
  });
});
