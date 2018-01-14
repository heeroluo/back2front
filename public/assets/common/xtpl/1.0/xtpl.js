const Promise = require('lib/promise@1.0');
const xTpl = require('lib/xtpl@4.6');
const commands = require('./commands');


module.exports = xTpl.createWrapper({
	loadTpl(tplPath) {
		if (/\?csrOnly$/.test(tplPath)) {
			return Promise.resolve('');
		}
		if (!/\.\w+$/.test(tplPath)) {
			tplPath += '.xtpl';
		}
		return new Promise(function(resolve) {
			resolve(require(tplPath));
		});
	},
	commands
});