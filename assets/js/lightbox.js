/*
	Minimal lightbox for the project figures.
	Opens the full image over the page instead of navigating away from it,
	so there is always a way back: the close button, a click on the
	backdrop, or Escape.
*/
(function () {

	var links = document.querySelectorAll('.project-figures a');

	if (!links.length)
		return;

	var overlay = document.createElement('div');
	overlay.className = 'lightbox';
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', 'Enlarged image');
	overlay.innerHTML =
		'<button class="lightbox__close" type="button" aria-label="Close image">' +
			'<span aria-hidden="true">&times;</span>' +
		'</button>' +
		'<figure class="lightbox__figure">' +
			'<img class="lightbox__img" src="" alt="" />' +
			'<figcaption class="lightbox__caption"></figcaption>' +
		'</figure>';
	document.body.appendChild(overlay);

	var image = overlay.querySelector('.lightbox__img'),
		caption = overlay.querySelector('.lightbox__caption'),
		closeButton = overlay.querySelector('.lightbox__close'),
		lastFocused = null;

	function open(href, alt) {
		lastFocused = document.activeElement;
		image.setAttribute('src', href);
		image.setAttribute('alt', alt || '');
		caption.textContent = alt || '';
		overlay.classList.add('is-open');
		document.body.classList.add('is-lightbox-open');
		closeButton.focus();
	}

	function close() {
		overlay.classList.remove('is-open');
		document.body.classList.remove('is-lightbox-open');
		image.setAttribute('src', '');

		if (lastFocused && lastFocused.focus)
			lastFocused.focus();
	}

	Array.prototype.forEach.call(links, function (link) {
		link.addEventListener('click', function (event) {
			event.preventDefault();

			var thumbnail = link.querySelector('img');
			open(link.getAttribute('href'), thumbnail ? thumbnail.getAttribute('alt') : '');
		});
	});

	closeButton.addEventListener('click', close);

	overlay.addEventListener('click', function (event) {
		if (event.target === overlay || event.target.classList.contains('lightbox__figure'))
			close();
	});

	document.addEventListener('keydown', function (event) {
		if (!overlay.classList.contains('is-open'))
			return;

		if (event.key === 'Escape' || event.key === 'Esc')
			close();

		/* keep focus on the close button while the dialog is open */
		if (event.key === 'Tab') {
			event.preventDefault();
			closeButton.focus();
		}
	});

})();
