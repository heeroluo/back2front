/**
 * 把指定路径解析成URL
 * @method toURL
 * @param {String} path 路径
 * @return {String} 解析后的URL
 */
exports.toURL = (path) => {
	var a = document.createElement('a');
	a.href = path;
	var url = a.href;
	a = null;
	return url;
};