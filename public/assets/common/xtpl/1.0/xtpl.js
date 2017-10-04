var Promise = require('lib/promise@1.0'),
	xTpl = require('lib/xtpl@4.6'),
	commands = require('./commands');


module.exports = xTpl.createWrapper({
	loadTpl: function(tplPath) {
		if (!/\.\w+$/.test(tplPath)) {
			tplPath += '.xtpl';
		}
		return new Promise(function(resolve) {
			resolve(require(tplPath));
		});
	},
	commands: commands
});