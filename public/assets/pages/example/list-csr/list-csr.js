const xTpl = require('common/xtpl@1.0');


xTpl.render(_tpl('components/list/1.0/list.xtpl'), {
	list: [
		'Item 1',
		'Item 2',
		'Item 3',
		'Item 4'
	]
}).then(function(result) {
	document.getElementById('list-outer').innerHTML = result;
});