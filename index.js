'use strict';


const request = require('request');
const Hoek = require('hoek');
const Joi = require('joi');
const debug = require('debug')('NaMiApi');



const CONFIG_SCHEMA = Joi.object().keys({
	userId: Joi.string().required(),
	password: Joi.string().required(),
	production: Joi.boolean().required(),
	productionBaseUrl: Joi.string().uri({	scheme: ['https'] }).required(),
	developmentBaseUrl: Joi.string().uri({ scheme: ['https', 'http'] }).required(),
	version: Joi.string().required()
});



const CONFIG_DEFAULTS = {
	production: false,
	userId: null,
	password: null,
	productionBaseUrl: 'https://nami.dpsg.de',
	developmentBaseUrl: 'https://namitest.dpsg.de',
	version: '1.1'
};



class NamiResponseError extends Error {

	constructor(code, msg) {
		super(msg);
		this.name = 'NamiResponseError';
		this.code = code;
	}

}



module.exports = class NamiApiWrapper {


	/**
	 * Class constructor
	 * @param {String} config.groupId 		Stammesnummer
	 * @param {String} config.userId 			Mitgliedsnummer eines Users mit API-Berechtigung
	 * @param {String} config.password 		Passwort des Users
	 * @param {Boolean} config.production if true nami.dpsg.de will be requested instead of namitest.dpsg.de
	 */
	constructor(config) {

		// configure
		this._configure(config);

		// Cookie jar for authenticated requests
		this._cookieJar = request.jar();

	}



	/**
	 * Process config object
	 * @param  {Object} config
	 * @return {void}
	 */
	_configure(config) {

		// create config based con defaults and given config
		config = Hoek.applyToDefaults(CONFIG_DEFAULTS, config);

		// validate config object with joi-configSchema
		const {error, value } = Joi.validate(config, CONFIG_SCHEMA, {
			convert: true
		});

		// Throw error in case of invalid config
		if(error) {
			throw error;
		}

		// Assign validated/sanitized validationResult (config-object) to client instance
		this._config = value;

		// parse/split version string
		this._config.parsedVersion = this._config.version.split('.');
	}




	/**
	 * Extends base url by given _path. Base-Url is selected based on _config.production
	 * @param  {String} path uri path
	 * @return {String}      uri
	 */
	_extendBaseUrl(_path) {
		let uri = this._config.production ? this._config.productionBaseUrl : this._config.developmentBaseUrl;
		let v = this._config.parsedVersion;
		let basePath = `/ica/rest/api/${v[0]}/${v[1]}/service`;
		return uri + basePath + _path;
	}




	/**
	 * Authenticate with credentials and store sessionId in _cookieJar
	 * @return {Promsie} resolves if authentication succeeds
	 */
	async _authenticate() {
		debug('authenticate');

		let res = await this._request({
			method: 'POST',
			uri: this._extendBaseUrl('/nami/auth/manual/sessionStartup'),
			followAllRedirects: true,
			jar: this._cookieJar,
			json: true,
			form: {
				Login: 'API',
				username: this._config.userId,
				password: this._config.password
			}
		});

		if(res.body && res.body.statusCode === 0) {
			return res.body;
		} else if(res.body && res.body.hasOwnProperty('statusCode')) {
			 throw new NamiResponseError(res.body.statusCode, res.body.statusMessage);
		} else {
			throw new Error('unknown authentication error');
		}

	}




	/**
	 * raw request using _cookieJar and reauthentication
	 * @param  {Object} options request config
	 * @return {Promise}        resolves with {raw, body}
	 */
	async _request(options) {
		return new Promise((resolve, reject) => {
			options.json = options.json || true;
			options.jar = options.jar || this._cookieJar;

			request(options, (err, res, body) => {
				if(err) {
					return reject(err);
				}

				resolve(res);
			});
		});
	}




	/**
	 * Call service path of api
	 * @param  {String} method  GET|POST|PUT|DELETE
	 * @param  {[type]} path    serivcePath
	 * @param  {Object} options { query }
	 * @return {Promise}        Resolves with response payload
	 */
	async callService(method = 'GET', path, options = {}) {
		debug('callService', method, path, options);

		let uri = this._extendBaseUrl(path);

		let res = await this._request({
			method,
			uri,
			qs: options.query || {}
		});

		let body = res.body;

		if(body && body.success === false && body.message === 'Session expired') {
			debug('unauthenticated');
			await this._authenticate();
			return this.callService(...arguments);
		}

		return body;

	}


};
