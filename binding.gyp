{
  'targets': [{
    'target_name': 'ffi_bindings',
    'sources': [
      'src/ffi.cc',
      'src/callback_info.cc',
      'src/threaded_callback_invokation.cc'
    ],
    'include_dirs': [
      "<!@(node -p \"require('node-addon-api').include\")",
      "<!@(node -p \"require('get-uv-event-loop-napi-h').include\")",
      "<!@(node -p \"require('ref-napi/lib/get-paths').include\")",
    ],
    'dependencies': [
      "<!(node -p \"require('node-addon-api').gyp\")",
      "deps/libffi/libffi.gyp:ffi"
    ],
    'cflags!': [ '-fno-exceptions' ],
    'cflags_cc!': [ '-fno-exceptions' ],
    'xcode_settings': {
      'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
      'CLANG_CXX_LIBRARY': 'libc++',
      'MACOSX_DEPLOYMENT_TARGET': '10.7',
    },
    'msvs_settings': {
      'VCCLCompilerTool': { 'ExceptionHandling': 1 },
    },
    'conditions': [
      ['OS=="win"', {
        'sources': [
            'src/win32-dlfcn.cc'
        ]
      }]
    ]
  }]
}
