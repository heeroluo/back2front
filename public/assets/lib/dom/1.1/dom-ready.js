/*!
 * JRaiser 2 Javascript Library
 * dom-ready@1.1.0 (2017-02-03T08:31:21Z)
 * http://jraiser.org/ | Released under MIT license
 */

/**
 * 本模块提供DOM Ready事件监听接口
 * @module dom/1.1.x/dom-ready
 * @catgory Infrastructure
 * @ignore
 */

/**
 * 添加DOM Ready事件回调
 * @method domReady
 * @exports
 * @param {Function} ready 回调函数
 */
module.exports = function(ready) {
	var fns = [], fn, f = false
		, doc = document
		, testEl = doc.documentElement
		, hack = testEl.doScroll
		, domContentLoaded = 'DOMContentLoaded'
		, addEventListener = 'addEventListener'
		, onreadystatechange = 'onreadystatechange'
		, readyState = 'readyState'
		, loaded = doc[readyState] !== 'loading'

	function flush(f) {
		loaded = 1
		while (f = fns.shift()) f()
	}

	doc[addEventListener] && doc[addEventListener](domContentLoaded, fn = function () {
		doc.removeEventListener(domContentLoaded, fn, f)
		flush()
	}, f)

	hack && doc.attachEvent(onreadystatechange, fn = function () {
		if (doc[readyState] !== 'loading') {
			doc.detachEvent(onreadystatechange, fn)
			flush()
		}
	})

	return (ready = hack ?
		function (fn) {
			self != top ?
				loaded ? fn() : fns.push(fn) :
			function () {
				try {
					testEl.doScroll('left')
				} catch (e) {
					return setTimeout(function() { ready(fn) }, 50)
				}
				fn()
			}()
		} :
		function (fn) {
			loaded ? fn() : fns.push(fn)
		}
	)
}();