var XTpl = require('common/xtpl@1.0');

setTimeout(function() {
	XTpl.render(require.resolve('./list-item.xtpl'), {
		list: ['a', 'b', 'c', 'd']
	}).then(function(result) {
		document.getElementById('list').innerHTML = result;
	});
}, 2000);