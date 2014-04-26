(function ($, createModule, undefined) {
	'use strict';

	var mod = createModule({
		id: 'ThreadUpdater',
		name: 'Actualiza las nuevas respuestas de un hilo.',
		author: 'Electrosa',
		version: '0.1-alpha-3',
		description: 'Dentro de un hilo, se añadirán nuevas respuestas automáticamente sin necesidad de recargar la página.',
		domain: ['/showthread.php'],
		initialPreferences: {
			enabled: false// versión preliminar, la dejo desactivada por defecto
		},
		preferences: {}
	});

	mod.getPreferenceOptions = function () {
		var creOpt = mod.helper.createPreferenceOption;

		return [
		];
	};

	mod.normalStartCheck = function () {
		return true;
	};

	const timeoutTabActive = 10000;
	const timeoutTabHidden = 30000;

	var numPostsBefore;// cantidad de posts al cargar el hilo
	var isLastPage;// ¿estamos en la última página del hilo?
	var newPostsElem, newPostsShown = false;// botón que el usuario debe pulsar para cargar los nuevos posts
	var posts = [];
	var pageTitle = document.title;
	var timeoutId, timeoutTime;// id (para clearTimeout), y fecha/hora en la que se debería ejecutar
	var thread, page;

	mod.onNormalStart = function () {
		numPostsBefore = document.getElementById("posts").children.length - 1;
		isLastPage = document.getElementsByClassName("pagenav").length
			? document.getElementsByClassName("pagenav")[0].querySelector("a[rel='next']") === null
			: true;// solo hay una página

		// comprobar si hay nuevos posts si la página no está completa o es la última
		if (numPostsBefore < 30 || isLastPage) {
			thread = getCurrentThread();
			page = getCurrentPage();

			// comprobar más tarde de nuevo si hay nuevos posts
			createTimeout();

			// crear el elemento ya para poder reservar su hueco
			GM_addStyle("#shurscript-newposts {width:100%; margin:12px 0; height: 32px}");
			GM_addStyle("#shurscript-newposts a {color: inherit; display: block; width: 100%}");// enlace nueva página

			var shurscriptWrapper = document.createElement("div");
			shurscriptWrapper.className = "shurscript";
			newPostsElem = document.createElement("div");
			newPostsElem.id = "shurscript-newposts";
			newPostsElem.className = "invisible btn btn-success";
			newPostsElem.onclick = populateNewPosts;
			shurscriptWrapper.appendChild(newPostsElem);

			var postsElem = document.getElementById("posts");// añadirlo después de #posts
			postsElem.parentNode.insertBefore(shurscriptWrapper, postsElem.nextSibling);

			/* Añadir evento para saber cuándo la pestaña adquiere el foco */
			document.addEventListener("visibilitychange", function () {
				var timeNow = +new Date();

				// al mostrar la página, si quedan más de 5 segundos para el timeout, cancelarlo y ejecutar la petición ya
				if (! document.hidden && timeoutId && timeNow + 5000 < timeoutTime) {
					stopTimeout();
					loadThread();
				}
			});

			/* Respuesta rápida */
			// controlar cuándo se envía el formulario
			document.getElementById("qrform").addEventListener("submit", function () {
				// quitar timeout actual
				stopTimeout();

				// ocultar el botón
				newPostsElem.classList.add("invisible");
				newPostsElem.textContent = "";
				newPostsShown = false;

				// restablecer el título
				document.title = pageTitle;
			});

			// reescribir la función que se encarga de recibir el post para añadir más funcionalidad
			var qr_do_ajax_post_original = unsafeWindow.qr_do_ajax_post;
			unsafeWindow.qr_do_ajax_post = function (ajax) {
				qr_do_ajax_post_original(ajax);// función original

				// comprobar si en el XML de respuesta hay <postbits>
				// en caso contrario es que ha salido el mensaje "debes esperar 30 segundos"
				if (ajax.responseXML.children[0].nodeName === "postbits") {
					// mirar número de respuestas ahora
					numPostsBefore = document.getElementById("posts").children.length - 1;

					// activar el timeout de nuevo
					createTimeout();
				} else {
					// si ha habido un error vuelve a mostrar el aviso
					createTimeout(1500);
				}
			};
		}
	};

	function createTimeout(interval) {
		if (! interval) {
			interval = document.hidden ? timeoutTabHidden : timeoutTabActive;
		}

		timeoutId = setTimeout(loadThread, interval);
		timeoutTime = +new Date() + interval;
	}

	function stopTimeout() {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = null;
		timeoutTime = null;
	}

	function loadThread() {
		stopTimeout();

		if (numPostsBefore < 30 || isLastPage) {
			var xmlhttp = new XMLHttpRequest();

			xmlhttp.onreadystatechange = function () {
				if (xmlhttp.readyState === 4 && xmlhttp.status === 200) {
					var html = xmlhttp.responseText;
					var parser = new DOMParser();
					var doc = parser.parseFromString(html, "text/html");

					var numPostsPrevious = posts.length;
					var isLastPagePrevious = isLastPage;

					//posts = doc.getElementById("posts").children;
					//var numPostsAfter = posts.length - 1;// en #posts, hay un div#lastpost que no nos interesa contar
					posts = doc.querySelectorAll("#posts > div[align]");
					var numPostsAfter = posts.length;
					isLastPage = doc.getElementsByClassName("pagenav").length
						? doc.getElementsByClassName("pagenav")[0].querySelector("a[rel='next']") === null
						: true;

					const _newPosts = numPostsBefore !== numPostsAfter && numPostsAfter !== numPostsPrevious;
					const _newPage = isLastPage !== isLastPagePrevious;

					// comprobar si hay nuevos posts y si no hay posts nuevos respecto a la última vez
					if (_newPosts || _newPage) {
						newPosts(numPostsAfter - numPostsBefore, _newPage);
					}

					// volver a comprobar
					createTimeout();
				}
			};

			xmlhttp.open("GET", "/foro/showthread.php?t=" + thread + "&page=" + page, true);
			xmlhttp.send();
		}
	}

	/**
	 * Muestra un botón para mostrar los nuevos posts o cargar la siguiente página.
	 * @param {int} numPosts Número de posts nuevos. Si es int(0), se crea un enlace a la siguiente página.
	 * @param {bool} newPage Existe una nueva página.
	 */
	function newPosts(numPosts, newPage) {
		// mostrar el elemento si está oculto
		if (! newPostsShown) {
			newPostsElem.classList.remove("invisible");
			newPostsShown = true;
		}

		// cambiar el título
		// En Firefox, al actualizar el título de la página, la pestaña (si está fijada) se marca como actualizada - https://i.imgur.com/qWb3sF9.png
		// Si el usuario ha entrado a la pestaña el aviso se va, por eso cambio el título de nuevo (con timeout) para que vuelva a aparecer el aviso si hay más posts nuevos.
		document.title = pageTitle;
		setTimeout(function () { document.title = "*" + pageTitle; }, 1);

		// mostrar el enlace a nueva página si ya se han cargado todos los posts de la página que estemos
		if (newPage && numPosts === 0) {
			// enlace a la nueva página
			newPostsElem.innerHTML = "<a href='showthread.php?t=" + thread + "&amp;page=" + (+page + 1) + "'>Hay una nueva página.</a>";
			newPostsElem.onclick = undefined;
		} else {
			// actualizar con el número de posts nuevos
			newPostsElem.textContent = numPosts === 1 ? "Hay un post nuevo." : "Hay " + numPosts + " posts nuevos.";
		}
	}

	/**
	 * Muestra los posts nuevos.
	 */
	function populateNewPosts() {
		// ocultar el botón
		newPostsElem.classList.add("invisible");
		newPostsElem.textContent = "";
		newPostsShown = false;

		// restablecer el título
		document.title = pageTitle;

		// añadir los posts
		var postsElem = document.getElementById("posts");
		var lastPostElem = document.getElementById("lastpost");
		var numPostsAfter = posts.length;

		for (var i = numPostsBefore, n = numPostsAfter; i < n; i++) {
			// añadir el post al DOM
			postsElem.insertBefore(posts[i], lastPostElem);

			// registrar el popup al hacer clic en el nombre de usuario
			var postId = posts[i].getElementsByTagName("table")[0].id.substr(4);
			unsafeWindow.vbmenu_register("postmenu_" + postId, true);// TODO - echarle un ojo a unsafeWindow.parseScript
		}

		// actualizar variable para respuesta rápida, determinará el número de posts a cargar la próxima vez
		unsafeWindow.ajax_last_post = (+new Date()) / 1000;

		// ahora el hilo tiene varios posts más
		numPostsBefore = numPostsAfter;

		// si hay nueva página, mostrar inmediatamente el botón
		if (! isLastPage) {
			newPosts(0, true);
		}
	}


	function getURLParameter(name) {
		return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [, ""])[1].replace(/\+/g, '%20'))
			|| null;
	}

	function getCurrentPage() {
		var r;

		if (r = getURLParameter("page")) return r;
		if (r = document.getElementById("showthread_threadrate_form")) return r.page.value;
		if (r = document.querySelector(".pagenav:first-child span strong")) return r.textContent;

		return -1;
	}

	function getCurrentThread() {
		var r;

		if (r = unsafeWindow.threadid) return r;
		if (r = getURLParameter("t")) return r;
		if (r = document.getElementById("qr_threadid")) return r.t.value;

		return null;
	}
})(jQuery, SHURSCRIPT.moduleManager.createModule);
