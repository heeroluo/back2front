!function(global) { 'use strict';

global.bowljs.config({
	basePath: '/assets/',
	debug: false,
	preload: [
		Function.prototype.bind ? '' : 'lib/compatibility/es5-shim.preload',
		window.JSON ? '' : 'lib/compatibility/json2.preload',
		window.localStorage ? '' : 'lib/compatibility/localstorage.preload'
	],
	map: [
		function(url) {
			if ( /\.qq\.com$/.test(url.hostname) ) {
				return;
			}

			var extname = '';
			url.pathname = url.pathname.replace( /(\.\w+)+$/, function(match) {
				extname = match;
				return '';
			})

			switch (extname) {
				case '.preload':
					extname = '.raw.js';
					break;

				case '.xtpl':
					extname = '.xtpl.js';
					break;
			}
			url.pathname += extname;
		}
	]
});

}(window);