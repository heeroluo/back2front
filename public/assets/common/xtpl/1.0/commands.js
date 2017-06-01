// 浏览器端无需处理引入静态资源的逻辑，直接输出空白即可
exports.css =
exports.js =
exports.modjs = function(scope, option, buffer) {
	var empty = '';
	return option.fn ?  buffer.write(empty) : empty;
};


// 解析静态资源路径
exports.resolvePath = (function() {
	// 静态资源URL前缀，在root模板中输出为全局变量
	var assetURLPrefix = '';
	try {
		assetURLPrefix = window.ASSET_URL_PREFIX;
	} catch (e) {

	}
	if (assetURLPrefix.charAt(assetURLPrefix.length - 1) !== '/') {
		assetURLPrefix += '/';
	}

	return function(scope, option) {
		var assetPath = option.params[0], result;

		if ( /^\./.test(assetPath) ) {
			result = this.name.split('/');
			// 解析相对路径，先拿掉最后的文件名
			result.pop();
			assetPath.split('/').forEach(function(item) {
				switch (item) {
					case '.':
						// 当前目录，不用处理
						break;

					case '..':
						// 上级目录，拿掉一层文件夹
						result.pop();
						break;

					default:
						// 下级目录或文件名
						result.push(item);
				}
			});
		} else {
			result = assetPath;
		}

		return assetURLPrefix + result.join('/');
	};
})();


// JSON序列化
exports.jsonEncode = function(scope, option) {
	return JSON.stringify(option.params[0]);
};

// 换行符转为 <br />
exports.nl2br = function(scope, option) {
	return String(option.params[0]).replace(/\r?\n/g, '<br />');
};

// 把空白替换成 &nbsp;
exports.space2nbsp = function(scope, option) {
	return toString(option.params[0]).replace(/\s{2,}/g, function(match) {
		return new Array(match.length + 1).join('&nbsp;');
	});
};