/*!
 * Back2Front
 * 工具函数
 */

'use strict';


/**
 * 对指定对象的每个元素执行指定函数
 * @method each
 * @param {Object|Array|ArrayLike} obj 目标对象
 * @param {Function(value,key,obj)} callback 操作函数，上下文为当前元素。
 *   当返回值为false时，遍历中断
 * @return {Object|Array|ArrayLike} 遍历对象
 */
exports.each = function(obj, callback) {
	if (obj != null) {
		let i;
		const len = obj.length;
		if (len === undefined || typeof obj === 'function') {
			for (i in obj) {
				if (obj.hasOwnProperty(i) && false === callback.call(obj[i], obj[i], i, obj)) {
					break;
				}
			}
		} else {
			i = -1;
			while (++i < len) {
				if (false === callback.call(obj[i], obj[i], i, obj)) {
					break;
				}
			}
		}
	}

	return obj;
};


/**
 * 判断指定字符串是否URL
 * @method isURL
 * @param {String} str 指定字符串
 * @return {String} 指定字符串是否URL
 */
exports.isURL = function(str) { return /^([a-z]+:)?\/\//i.test(str); };