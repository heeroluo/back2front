const argvs = require('minimist')(process.argv.slice(2));

let isProd;
[argvs.env, process.env.NODE_ENV].some((item) => {
	// 统一环境写法
	item = {
		'': 'local',
		'development': 'dev',
		'pre-release': 'pre',
		'production': 'prod'
	}[item] || item;

	if (['local', 'dev', 'test', 'pre', 'prod'].indexOf(item) !== -1) {
		isProd = !(item === 'local' || argvs.prod === false);
		process.env.NODE_ENV = isProd ? 'production' : 'development';
		process.env.BACK2FRONT_ENV = item;
		return true;
	}
});


module.exports = {
	// 环境
	env: process.env.BACK2FRONT_ENV,
	nodeEnv: process.env.NODE_ENV,

	// 占用的端口
	port: 3000,

	// 本应用发布后是否作为静态文件服务器
	isStaticServer: false,

	// 静态文件设置
	static: {
		maxAge: isProd ? 3 * 24 * 60 * 60 * 1000 : 0
	},

	// 前后端同构的XTemplate指令模块（路径相对于 lib/xtpl.js）
	xTplCommands: '../public/assets/xtpl/commands'
};