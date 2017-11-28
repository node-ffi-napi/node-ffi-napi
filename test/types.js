'use strict';
const assert = require('assert')
const ref = require('ref-napi')
const ffi = require('../')

describe('types', function () {
  describe('`ffi_type` to ref type matchups', function () {
    Object.keys(ref.types).forEach(name => {
      it('should match a valid `ffi_type` for "' + name + '"', () =>{
        const type = ref.types[name];
        const ffi_type = ffi.ffiType(type);
        assert(Buffer.isBuffer(ffi_type));
      });
    });

    it('should match a valid `ffi_type` for "ref" type without a cached value', function () {
      // simulate a ref type without a "ffi_type" property set
      const type = Object.create(ref.types.void);
      type.ffi_type = undefined;

      const ffi_type = ffi.ffiType(type);
      assert(Buffer.isBuffer(ffi_type));
    });

    it('should match a valid `ffi_type` for `CString` without a cached value', function () {
      // simulate a ref type without a "ffi_type" property set
      const type = Object.create(ref.types.CString);
      type.ffi_type = undefined;

      const ffi_type = ffi.ffiType(type);
      assert(Buffer.isBuffer(ffi_type));
    });

    it('should match a valid `ffi_type` for `ulong` without a cached value', function () {
      // simulate a ref type without a "ffi_type" property set
      const type = Object.create(ref.types.ulong);
      type.ffi_type = undefined;

      const ffi_type = ffi.ffiType(type);
      assert(Buffer.isBuffer(ffi_type));
    });
  });
});
