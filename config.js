var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
	env: env,
	port: 3000,
	isStaticServer: false,
	static: {
		maxAge: env === 'development'
			? 0
			: 3 * 24 * 60 * 60 * 1000
	}
};