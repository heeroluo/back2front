!function(global) { 'use strict';

global.bowljs.config({
	basePath: '/assets/',
	debug: false,
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
					extname = '.js';
					break;

				case '.xtpl':
					extname = '.xtpl.js';
					break;

				case '.js':
					extname = '.mod.js';
					break;
			}
			url.pathname += extname;
		}
	],
	preload: [
		Function.prototype.bind ? '' : 'layouts/basic/1.0/es5-shim.preload',
		window.JSON ? '' : 'layouts/basic/1.0/json2.preload',
		window.localStorage ? '' : 'layouts/basic/1.0/localstorage.preload'
	]
});

}(window);