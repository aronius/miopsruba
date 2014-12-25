/**
 * Inicializa el objeto que contiene la aplicacion,
 * Empaqueta las funciones de GreaseMonkey en un objeto
 * Genera el core.
 */
var SHURSCRIPT = {
	GreaseMonkey: {
		log: GM_log,
		getValue: GM_getValue,
		setValue: GM_setValue,
		deleteValue: GM_deleteValue,
		xmlhttpRequest: GM_xmlhttpRequest,
		registerMenuCommand: GM_registerMenuCommand,
		addStyle: GM_addStyle,
		getResourceText: GM_getResourceText,
		getResourceURL: GM_getResourceURL
	},
	config: {
		server: "http://cloud.shurscript.org:8080/"
	},
	environment: {
		page: location.pathname.indexOf("/foro") != -1 ? location.pathname.replace("/foro", "") : "frontpage",
		thread: {
			id: getCurrentThread(),
			page: getCurrentPage(),
			isClosed: document.getElementById("qrform") === null
		}
	}
};

function getCurrentPage() {
	var r;

	if (r = decodeURIComponent((new RegExp('[?|&]page=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1])) return r;// from URL parameter
	if (r = document.getElementById("showthread_threadrate_form")) return r.page.value;
	if (r = document.querySelector(".pagenav:first-child span strong")) return r.textContent;

	return null;
}

function getCurrentThread() {
	var r;

	if (r = unsafeWindow.threadid) return r;
	if (r = decodeURIComponent((new RegExp('[?|&]t=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1])) return r;// from URL parameter
	if (r = document.getElementById("qr_threadid")) return r.t.value;

	return null;
}

/**
 * @param {object} $ - jQuery object
 * @param {object} _ - underscore object
 * @param {object} bootbox - bootbox object
 * @param {object} console - console object
 * @param {undefined} undefined - safe reference to undefined
 */
(function ($, _, SHURSCRIPT, bootbox, console, undefined) {
	'use strict';

	var core = {},
		GM = SHURSCRIPT.GreaseMonkey;

	SHURSCRIPT.core = core;

	/**
	 * Comprobamos que está soportada la extensión y seteamos al objeto SHURSCRIPT la version y la rama del script actual.
	 */
	var isCompatible = function () {

		var version;
		if (typeof GM_info !== "undefined") { // GreaseMonkey, TamperMonkey, ...
			version = GM_info.script.version;
		} else if (typeof GM_getMetadata !== "undefined") { // Scriptish
			version = GM_getMetadata('version') + ''; // getMetadata returns: Object, String or Array
		} else {
			return false;
		}

		// TODO [ikaros45 29.03.2014]: los side-effects hacen llorar al ninyo jesus.
		//Separamos número de versión y nombre de la rama (master, dev o exp)
		var splitted = version.split("-");
		SHURSCRIPT.scriptVersion = splitted[0];
		SHURSCRIPT.scriptBranch = splitted[1] || "master";

		return true;
	};

	/**
	 * Prototipo para los helpers para componentes
	 */
	var protoComponentHelper = {
		/**
		 * Inicializa el objeto
		 * @param moduleId - id del propietario de este helper
		 */
		__init__: function (moduleId) {
			this.moduleId = moduleId;

			// Elimina este metodo ya que no se debe usar mas
			delete this.__init__;

			// Devuelve el objeto para hacer concatenacion
			return this;
		},
		log: function (message) {
			console.log(this._getCallerDescription() + message);
			var $log = $('#shurscript_log');

			if ($log.length === 0) {
				$(document.body).append('<div id="shurscript_log" style="display:none;"></div>');
				$log = $('#shurscript_log');
			}
			$log.append(message + "<br>");
		},

		/**
		 * Compone el string para este modulo + usuario + key
		 *
		 * @param {string} key - nombre de la llave
		 * @param {boolean} [withId] - bool para incluir o no el ID del usuario en la llave. Default: false
		 */
		_getShurKey: function (key, withId) {
			var id = (withId === true) ? '_' + SHURSCRIPT.environment.user.id : '';
			return 'SHURSCRIPT_' + this.moduleId + '_' + key + id;
		},

		/**
		 * Compone una cadena con el nombre del modulo que esta llamando al helper y la hora
		 */
		_getCallerDescription: function () {
			return '[SHURSCRIPT]  [Modulo ' + this.moduleId + '] ' + new Date().toLocaleTimeString() + ': ';
		},

		/**
		 * Almacena un valor en el servidor y ejecuta el callback al terminar
		 * @param key
		 * @param value
		 * @param callback
		 */
		setValue: function (key, value, callback) {
			GM.setValue(this._getShurKey(key, false), value, callback);
		},

		/**
		 * Devuelve un valor del servidor, o el defaultValue si no encuentra la clave
		 * @param key
		 * @param defaultValue
		 */
		getValue: function (key, defaultValue) {
			return GM.getValue(this._getShurKey(key, false), defaultValue);
		},

		/**
		 * Elimina un valor del servidor
		 *
		 * @param key
		 * @param {function} callback - funcion a ejecutar despues de la operacion
		 */
		deleteValue: function (key, callback) {
			GM.deleteValue(this._getShurKey(key, false), callback);
		},

		/**
		 * Almacena un valor en el navegador
		 * @param key
		 * @param value
		 */
		setLocalValue: function (key, value) {
			GM_setValue(this._getShurKey(key, true), value);
		},

		/**
		 * Devuelve un valor del navegador, o el defaultValue si no encuentra la clave
		 * @param key
		 * @param defaultValue
		 */
		getLocalValue: function (key, defaultValue) {
			return GM_getValue(this._getShurKey(key, true), defaultValue);
		},

		/**
		 * Elimina un valor del navegador
		 *
		 * @param key - nombre llave
		 */
		deleteLocalValue: function (key) {
			GM_deleteValue(this._getShurKey(key, true));
		},

		/**
		 * Lanza excepcion
		 *
		 * @param {string} message - mensaje para la excepcion
		 * @param {object} exception - [opcional] la excepcion
		 */
		throw: function (message, exception) {
			//console.log(new Error().stack);
			this.log('[EXCEPTION] - ' + message);
			if (exception !== undefined) {
				this.log(exception);
				console.log(exception);
			}
		},

		/**
		 * Mete CSS previamente registrado en archivo principal con @resource
		 *
		 * @param {string} styleResource - nombre del recurso css
		 */
		addStyle: function (styleResource) {
			var css = GM.getResourceText(styleResource);
			GM.addStyle(css);
		},

		/**
		 * Muestra un mensaje al usuario en una barra arriba de la página
		 *
		 * @param {object} properties {
		 *						message: "Mensaje a mostrar",
		 *						type: ["info", "success", "warning", "danger"],
		 *						onClose: "Función a ejecutar después al hacer clic en el aspa de cerrar"
		 *                 }
		 */
		showMessageBar: function (properties) {
			SHURSCRIPT.topbar.showMessage(properties);
		},

		getResourceText: GM.getResourceText,
		getResourceURL: GM.getResourceURL,
		bootbox: bootbox,
		location: location
	};

	/**
	 * Devuelve el protoModuleHelper, asegurandose de que esta
	 * extendido con los nuevos elementos
	 */
	var getProtoModuleHelper = function () {
		var moduleHelper = Object.create(protoComponentHelper);
		moduleHelper.createPreferenceOption = SHURSCRIPT.preferences.createOption;
		moduleHelper.templater = SHURSCRIPT.templater;
		moduleHelper.environment = SHURSCRIPT.environment;
		return moduleHelper;
	};

	/**
	 * Crea un helper para COMPONENTES
	 *
	 * @param {string} moduleId - id modulo o componente
	 */
	core.createComponentHelper = function (moduleId) {
		return Object.create(protoComponentHelper).__init__(moduleId);
	};

	/**
	 * Crea un helper para MODULOS. Como los modulos no tienen accesso a SHURSCRIPT,
	 * reciben un helper más completo con acceso a otros componentes que no existían
	 * cuando protoComponentHelper se creo
	 *
	 * @param {string} moduleId
	 */
	core.createModuleHelper = function (moduleId) {
		return getProtoModuleHelper().__init__(moduleId);
	};

	core.helper = core.createComponentHelper('core');

	/**
	 * Crea un componente para la aplicacion
	 *
	 * @param {string} id - id componente
	 */
	core.createComponent = function (id) {
		if (id === undefined) {
			core.helper.throw('Error al crear componente. El ID no ha sido definido.');
		}

		// Crea namespace y copiale las propiedades
		var comp = {id: id};
		SHURSCRIPT[id] = comp;

		// Registra el componente
		if (core.components === undefined) {
			core.components = [];
		}
		core.components.push(id);

		// Metele un helper
		comp.helper = core.createComponentHelper(comp.id);

		return comp;
	};

	/**
	 * Inicializa la aplicacion de modo normal
	 */
	core.initialize = function () {

		if (!isCompatible()) {
			alert('SHURSCRIPT: El complemento o extensión de userscripts que usas en tu navegador no está soportado.');
			return;
		}

		var body_html = $('body').html();

		// Saca por regexps id
		var id_regex_results = /userid=(\d*)/.exec(body_html);

		// Si el usuario no está logueado, aborta.
		if (!id_regex_results) {
			return;
		}

		var userid = id_regex_results[1];

		// Guarda info usuario
		var username;
		if (SHURSCRIPT.environment.page === "frontpage") {
			username = $(".cajascat td.cat:nth-child(1)").text().substr(3);
		} else {
			username = $(".smallfont a[href='member.php?u=" + userid + "']").first().text();
		}

		SHURSCRIPT.environment.user = {
			id: userid,
			name: username
		};

		SHURSCRIPT.environment.browser = {
			name: navigator.userAgent
		};

		// Mete bootstrap
		core.helper.addStyle('bootstrapcss');

		// Configuracion de las ventanas modales
		core.helper.bootbox.setDefaults({
			locale: "es",
			className: "shurscript",
			closeButton: false
		});

		_.extend(SHURSCRIPT.config, {
									  "web": "http://shurscript.org/",
									  "fcThread": "http://www.forocoches.com/foro/showthread.php?t=4024355",
									  "imagesURL": "http://static.shurscript.org/img/",
									  "repositoryURL": "https://github.com/TheBronx/shurscript/",
									  "updateURL": "http://static.shurscript.org/js/beta/0.23.1/shurscript.min.user.js",
									  "installURL": "http://static.shurscript.org/js/beta/0.23.1/shurscript.min.user.js",
									  "visualChangelog": "https://github.com/TheBronx/shurscript/blob/dev/CHANGELOG.md",
									  "visualFAQ": "https://github.com/TheBronx/shurscript/wiki/FAQ-(Indice)",
									  "rawChangelog": "https://github.com/TheBronx/shurscript/raw/dev/CHANGELOG.md",
									  "imgurClientID": "e115ac41fea372d"
									});

		//lanza la carga de componentes y modulos
		core.loadNextComponent();
	};

	// Carga el siguiente componente. En caso contrario llama a la carga de módulos.
	// La carga de componentes se hace asíncronamente y por orden de "registro" (SHURSCRIPT.core.createComponent())
	// cada componente debe implementar un método load(callback) y llamar a dicho callback cuando termine
	// Así se permite que los componentes puedan bloquear la carga del resto de scripts y módulos
	core.loadNextComponent = function () {
		var component = core.getNextComponent();

		if (component === undefined) {
			// No quedan componentes, lanza carga modulos
			SHURSCRIPT.moduleManager.startOnDocReadyModules();
			return;
		}

		SHURSCRIPT.eventbus.trigger('loadingComponent', component);

		// TODO [ikaros45 28.03.2014]: No hay que comprobar si la funcion existe, sino definir una
		// funcion dummy en el prototype que puede ser sobreescrita por los modulos

		if (_.isFunction(component.loadAndCallback)) { // existe funcion de carga?
			core.helper.log("Cargando componente " + component.id);
			component.loadAndCallback(core.loadNextComponent); //carga y una vez termines llama a loadNextComponent
			return;
		}

		// TODO [ikaros45 28.03.2014]: lo mismo aqui... no hay que comprobar si existe!
		if (_.isFunction(component.load)) {
			component.load(); // sin callback
		}

		core.helper.log("Cargando componente " + component.id);

		core.loadNextComponent();
	};

	// devuelve el siguiente componente en el proceso de carga
	core.getNextComponent = function () {
		if (core.components !== undefined) {
			if (core.componentIndex === undefined) {
				core.componentIndex = 0;
			} else {
				core.componentIndex += 1;
			}
			return SHURSCRIPT[core.components[core.componentIndex]];
		}
	};

	/**
	 * Inicializa la aplicacion en modo prematuro (antes del doc ready)
	 */
	core.initializeEagerly = function () {
		// De forma pseudo-asincronica, espera hasta que el head este cargado
		SHURSCRIPT.moduleManager.startEagerModules();
	};

})(jQuery, _, SHURSCRIPT, bootbox, console);
