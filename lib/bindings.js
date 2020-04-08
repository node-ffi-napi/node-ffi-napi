'use strict';
var path = require('path');
module.exports = require('node-gyp-build')(path.join(__dirname, '..'));
