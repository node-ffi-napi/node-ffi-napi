'use strict';
const assert = require('assert');
const ref = require('ref');
const ffi = require('../');
const voidPtr = ref.refType(ref.types.void);

// these are "opaque" pointer types, so we only care about the memory addess,
// and not the contents (which are internal to Apple). Therefore we can typedef
// these opaque types to `void *` and it's essentially the same thing.
const id = voidPtr;
const SEL = voidPtr;
const Class = voidPtr;

if (!ffi.HAS_OBJC)
  return;

describe('@try / @catch', function () {
  // not entirely sure why this works, but we have to load `Foundation` first,
  // otherwise Objective-C exceptions will not work. Magic!
  // https://github.com/node-ffi/node-ffi/issues/195
  const lib = ffi.DynamicLibrary('/System/Library/Frameworks/Foundation.framework/Versions/Current/Foundation');

  afterEach(gc);

  const objcLib = new ffi.Library('libobjc', {
    'objc_msgSend': [ id, [ id, SEL ] ],
    'objc_getClass': [ Class, [ 'string' ] ],
    'sel_registerName': [ SEL, [ 'string' ] ]
  });

  // create an NSAutoreleasePool instance
  const NSAutoreleasePool = objcLib.objc_getClass('NSAutoreleasePool');
  const sel_new = objcLib.sel_registerName('new');
  const pool = objcLib.objc_msgSend(NSAutoreleasePool, sel_new);

  it('should proxy @try/@catch to JavaScript via try/catch/throw', function () {
    const sel_retain = objcLib.sel_registerName('retain');
    assert.throws(function () {
      objcLib.objc_msgSend(pool, sel_retain);
    });
  });

  it('should throw a Buffer instance when an exception happens', function () {
    const sel_retain = objcLib.sel_registerName('retain');
    assert.throws(function () {
      objcLib.objc_msgSend(pool, sel_retain);
    }, function (e) {
      return Buffer.isBuffer(e)
          && !e.isNull()
          && e.address() > 0;
    });
  });
});
