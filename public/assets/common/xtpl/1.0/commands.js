exports.css =
exports.js =
exports.modjs = function(scope, option, buffer) {
	var empty = '';
	return option.fn ?  buffer.write(empty) : empty;
};