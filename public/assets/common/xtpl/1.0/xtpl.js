var Promise = require('lib/promise@1.0'),
	xTpl = require('lib/xtpl@4.6'),
	commands = require('./commands');


module.exports = xTpl.createWrapper({
	loadTpl: function(tplPath) {
		return new Promise(function(resolve, reject) {
			var extname = '.xtpl'
			if ( !/\.\w+$/.test(tplPath) ) {
				tplPath += extname;
			} else {
				tplPath = tplPath.replace(/\.js$/, extname);
			}
			resolve( require(tplPath) );
		});
	},
	commands: commands
});