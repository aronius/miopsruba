/**
 * Módulo de sincronización de preferencias en la nube
 * Sobreescribe los métodos getValue, setValue y deleteValue del objeto core.GreaseMonkey
 * IMPORTANTE: debe cargarse antes que cualquier otro componente/módulo que no sea el propio core
 */
(function ($, SHURSCRIPT, undefined) {
	'use strict';

	var sync = SHURSCRIPT.core.createComponent('sync');

	//por si queremos usar los get/set/delete que trabajan en local y no en la nube
	var Cloud = {
		setValue: SHURSCRIPT.GreaseMonkey.setValue,
		getValue: SHURSCRIPT.GreaseMonkey.getValue,
		deleteValue: SHURSCRIPT.GreaseMonkey.deleteValue,
		preferences: {},

		getAll: function (callback) {
			_.extend(this.preferences,{"SHURSCRIPT_AutoIcons_MOST_USED_ICONS" : this.getValue("SHURSCRIPT_AutoIcons_MOST_USED_ICONS",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_AutoIcons___preferences" : this.getValue("SHURSCRIPT_AutoIcons___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_AutoSpoiler___preferences" : this.getValue("SHURSCRIPT_AutoSpoiler___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_BetterPosts_POST_BACKUP" : this.getValue("SHURSCRIPT_BetterPosts_POST_BACKUP",false)});
			_.extend(this.preferences,{"SHURSCRIPT_BetterPosts___preferences" : this.getValue("SHURSCRIPT_BetterPosts___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_FilterThreads_FAVORITES" : this.getValue("SHURSCRIPT_FilterThreads_FAVORITES",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_FilterThreads_HIDDEN_THREADS" : this.getValue("SHURSCRIPT_FilterThreads_HIDDEN_THREADS",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_FilterThreads___preferences" : this.getValue("SHURSCRIPT_FilterThreads___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_HighlightOP___preferences" : this.getValue("SHURSCRIPT_HighlightOP___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_History___preferences" : this.getValue("SHURSCRIPT_History___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_ImageGallery___preferences" : this.getValue("SHURSCRIPT_ImageGallery___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_ImageUploader___preferences" : this.getValue("SHURSCRIPT_ImageUploader___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_NestedQuotes___preferences" : this.getValue("SHURSCRIPT_NestedQuotes___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_Quotes_LAST_QUOTES" : this.getValue("SHURSCRIPT_Quotes_LAST_QUOTES",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_Quotes_LAST_QUOTES_UPDATE" : this.getValue("SHURSCRIPT_Quotes_LAST_QUOTES_UPDATE",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_Quotes_LAST_READ_QUOTE" : this.getValue("SHURSCRIPT_Quotes_LAST_READ_QUOTE",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_Quotes___preferences" : this.getValue("SHURSCRIPT_Quotes___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_Reader___preferences" : this.getValue("SHURSCRIPT_Reader___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_RefreshSearch___preferences" : this.getValue("SHURSCRIPT_RefreshSearch___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_Scrollers___preferences" : this.getValue("SHURSCRIPT_Scrollers___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_ThreadUpdater___preferences" : this.getValue("SHURSCRIPT_ThreadUpdater___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_Webm___preferences" : this.getValue("SHURSCRIPT_Webm___preferences",'[]')});
			_.extend(this.preferences,{"SHURSCRIPT_moduleManager_MIGRATION_DONE" : this.getValue("SHURSCRIPT_moduleManager_MIGRATION_DONE",false)});
			_.extend(this.preferences,{"SHURSCRIPT_notifications_NOTIFICATIONS" : this.getValue("SHURSCRIPT_notifications_NOTIFICATIONS",'[]')});

			callback();
		},
	};

	//Punto de entrada al componente.
	sync.loadAndCallback = function (callback) {
		//sobreescribimos las funciones de manejo de preferencias
		// [cb] es opcional, se ejecuta una vez los datos se guardan en el servidor asíncronamente
		SHURSCRIPT.GreaseMonkey.setValue = function (key, value, cb) {
			Cloud.preferences[key] = value; //Copia local
			Cloud.setValue(key, value);
			if (cb) {
				cb();
			}
		};

		SHURSCRIPT.GreaseMonkey.getValue = function (key, defaultValue) {
			//utilizamos la copia local de esa clave (si leyésemos del server los getValue serían asíncronos)
			return (Cloud.preferences[key] != undefined) ? Cloud.preferences[key] : defaultValue;
		};

		SHURSCRIPT.GreaseMonkey.deleteValue = function (key, callback) {
			SHURSCRIPT.GreaseMonkey.setValue(key,'',callback);
		};

		Cloud.getAll(callback); //notificamos al core, el siguiente componente ya puede cargar
	};
})(jQuery, SHURSCRIPT);
