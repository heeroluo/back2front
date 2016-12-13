var Promise = require('lib/promise@1.0'),
	xTpl = require('lib/xtpl@4.6'),
	commands = require('./commands');


module.exports = xTpl.createWrapper({
	loadTpl: function(tplPath) {
		return new Promise(function(resolve, reject) {
			require.async(tplPath, function(tpl) {
				resolve(tpl);
			});
		});
	},
	commands: commands
});