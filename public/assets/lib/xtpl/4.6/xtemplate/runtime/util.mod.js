'use strict';

// http://www.owasp.org/index.php/XSS_(Cross_Site_Scripting)_Prevention_Cheat_Sheet
// http://wonko.com/post/html-escaping

var escapeHtml = require('./escape-html');

var SUBSTITUTE_REG = /\\?\{([^{}]+)\}/g;
var win = typeof global !== 'undefined' ? global : window;

var util = void 0;
var toString = Object.prototype.toString;
module.exports = util = {
  isArray: Array.isArray || function isArray(obj) {
    return toString.call(obj) === '[object Array]';
  },

  keys: Object.keys || function keys(o) {
    var result = [];
    var p = void 0;

    for (p in o) {
      if (o.hasOwnProperty(p)) {
        result.push(p);
      }
    }

    return result;
  },

  each: function each(object, fn) {
    var context = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    if (object) {
      var key = void 0;
      var val = void 0;
      var keys = void 0;
      var i = 0;
      var length = object && object.length;
      // do not use typeof obj == 'function': bug in phantomjs
      var isObj = length === undefined || Object.prototype.toString.call(object) === '[object Function]';

      if (isObj) {
        keys = util.keys(object);
        for (; i < keys.length; i++) {
          key = keys[i];
          // can not use hasOwnProperty
          if (fn.call(context, object[key], key, object) === false) {
            break;
          }
        }
      } else {
        for (val = object[0]; i < length; val = object[++i]) {
          if (fn.call(context, val, i, object) === false) {
            break;
          }
        }
      }
    }
    return object;
  },
  mix: function mix(t, s) {
    if (s) {
      for (var p in s) {
        if (s.hasOwnProperty(p)) {
          t[p] = s[p];
        }
      }
    }
    return t;
  },
  globalEval: function globalEval(data) {
    if (win.execScript) {
      win.execScript(data);
    } else {
      /* eslint wrap-iife:0 */
      (function run(d) {
        win.eval.call(win, d);
      })(data);
    }
  },
  substitute: function substitute(str, o, regexp) {
    if (typeof str !== 'string' || !o) {
      return str;
    }

    return str.replace(regexp || SUBSTITUTE_REG, function (match, name) {
      if (match.charAt(0) === '\\') {
        return match.slice(1);
      }
      return o[name] === undefined ? '' : o[name];
    });
  },


  escapeHtml: escapeHtml,

  merge: function merge() {
    var i = 0;
    var len = arguments.length;
    var ret = {};
    for (; i < len; i++) {
      var arg = arguments.length <= i ? undefined : arguments[i];
      if (arg) {
        util.mix(ret, arg);
      }
    }
    return ret;
  }
};