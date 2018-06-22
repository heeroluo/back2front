const xTpl = require('xtpl/xtpl');
const tabs = require('components/tabs/1.0/tabs');
const $ = require('lib/dom/1.1/dom');

tabs.init($('.c-tabs'));

xTpl.render(
	_tpl('components/tabs/1.0/tabs.xtpl'),
	{
		tabsNav: ['Tab E', 'Tab F', 'Tab G', 'Tab H'],
		tabsBody: ['I am E', 'I am F', 'I am G', 'I am H']
	}
).then((html) => {
	const $elt = $(html).appendTo('#main');
	tabs.init($elt);
});