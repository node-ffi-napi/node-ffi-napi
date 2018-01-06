node-ffi-napi
=============
### Node.js Foreign Function Interface for N-API
[![Greenkeeper badge](https://badges.greenkeeper.io/node-ffi-napi/node-ffi-napi.svg)](https://greenkeeper.io/)

[![NPM Version](https://img.shields.io/npm/v/ffi-napi.svg?style=flat)](https://npmjs.org/package/ffi-napi)
[![NPM Downloads](https://img.shields.io/npm/dm/ffi-napi.svg?style=flat)](https://npmjs.org/package/ffi-napi)
[![Build Status](https://travis-ci.org/node-ffi-napi/node-ffi-napi.svg?style=flat&branch=master)](https://travis-ci.org/node-ffi-napi/node-ffi-napi?branch=master)
[![Coverage Status](https://coveralls.io/repos/node-ffi-napi/node-ffi-napi/badge.svg?branch=master)](https://coveralls.io/r/node-ffi-napi/node-ffi-napi?branch=master)
[![Dependency Status](https://david-dm.org/node-ffi-napi/node-ffi-napi.svg?style=flat)](https://david-dm.org/node-ffi-napi/node-ffi-napi)

`node-ffi-napi` is a Node.js addon for loading and calling dynamic libraries
using pure JavaScript. It can be used to create bindings to native libraries
without writing any C++ code.

It also simplifies the augmentation of node.js with C code as it takes care of
handling the translation of types across JavaScript and C, which can add reams
of boilerplate code to your otherwise simple C. See the `example/factorial`
for an example of this use case.

**WARNING**: `node-ffi-napi` assumes you know what you're doing. You can pretty
easily create situations where you will segfault the interpreter and unless
you've got C debugger skills, you probably won't know what's going on.

**WARNING**: The original API of `node-ffi` is left mostly untouched in the
N-API wrapper. However, the API did not have very well-defined properties
in the context of garbage collection and multi-threaded execution. It is
recommended to avoid any multi-threading usage of this library
if possible.

Example
-------

``` js
var ffi = require('ffi-napi');

var libm = ffi.Library('libm', {
  'ceil': [ 'double', [ 'double' ] ]
});
libm.ceil(1.5); // 2

// You can also access just functions in the current process by passing a null
var current = ffi.Library(null, {
  'atoi': [ 'int', [ 'string' ] ]
});
current.atoi('1234'); // 1234
```

For a more detailed introduction, see the [node-ffi tutorial page][tutorial].

Requirements
------------

 * Linux, OS X, Windows, or Solaris.
 * `libffi` comes bundled with node-ffi-napi; it does *not* need to be installed on your system.
 * The current version is tested to run on Node 6 and above.

Installation
------------

Make sure you've installed all the [necessary build
tools](https://github.com/TooTallNate/node-gyp#installation) for your platform,
then invoke:

``` bash
$ npm install ffi-napi
```

Source Install / Manual Compilation
-----------------------------------

To compile from source it's easiest to use
[`node-gyp`](https://github.com/TooTallNate/node-gyp):

``` bash
$ npm install -g node-gyp
```

Now you can compile `node-ffi-napi`:

``` bash
$ git clone git://github.com/node-ffi-napi/node-ffi-napi.git
$ cd node-ffi
$ node-gyp rebuild
```

Types
-----

The types that you specify in function declarations correspond to ref's types
system. So [see its docs][ref-types] for
a reference if you are unfamiliar.

V8 and 64-bit Types
-------------------

Internally, V8 stores integers that will fit into a 32-bit space in a 32-bit
integer, and those that fall outside of this get put into double-precision
floating point numbers. This is problematic because FP numbers are imprecise.
To get around this, the methods in node-ffi that deal with 64-bit integers return
strings and can accept strings as parameters.

Call Overhead
-------------

There is non-trivial overhead associated with FFI calls. Comparing a hard-coded
binding version of `strtoul()` to an FFI version of `strtoul()` shows that the
native hard-coded binding is orders of magnitude faster. So don't just use the
C version of a function just because it's faster. There's a significant cost in
FFI calls, so make them worth it.

License
-------

MIT License. See the `LICENSE` file.

[v1apichanges]: https://github.com/node-ffi/node-ffi/wiki/API-changes-from-v0.x-to-v1.x
[tutorial]: https://github.com/node-ffi/node-ffi/wiki/Node-FFI-Tutorial
[ref-types]: https://github.com/TooTallNate/ref#built-in-types
