let env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
	env: env,

	// 占用的端口
	port: 3000,

	// 本应用发布后是否作为静态文件服务器
	isStaticServer: false,

	// 静态文件设置
	static: {
		maxAge: env === 'development' || env === 'test' ?
			0 :
			3 * 24 * 60 * 60 * 1000
	},

	// 前后端同构的XTemplate指令模块（路径相对于 lib/xtpl.js）
	xTplCommands: '../public/assets/common/xtpl/1.0/commands'
};