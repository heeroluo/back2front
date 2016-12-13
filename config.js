var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';

module.exports = {
	env: process.env,
	port: 3000,
	static: {
		maxAge: env === 'development'
			? 0
			: 3 * 24 * 60 * 60 * 1000
	}
};