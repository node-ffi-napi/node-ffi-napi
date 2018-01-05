{
  'targets': [{
    'target_name': 'ffi_tests',
    'sources': [
      'ffi_tests.cc'
    ],
    'include_dirs': [
      "<!@(node -p \"require('node-addon-api').include\")",
      "<!@(node -p \"require('get-uv-event-loop-napi-h').include\")"
    ],
    'dependencies': [
      "<!(node -p \"require('node-addon-api').gyp\")"
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
    }
  }]
}
