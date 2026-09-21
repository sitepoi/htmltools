/* ── One-pager shared behavior (all features) ───────────────────────────────
   Used by every <feature>/_onepager.html. Wires the Print button, the
   Export PDF button (html2pdf loaded on demand) and the scroll-reveal
   animation. No per-document scripts allowed. */
(function () {
	'use strict'

	function loadHtml2Pdf(onReady) {
		if (window.html2pdf) { onReady(); return }
		var pdfScript = document.createElement('script')
		var loadTimeout = setTimeout(function () {
			if (window.html2pdf) return
			window.alert('The PDF engine is taking too long - check your internet connection, then try again.')
		}, 12000)
		pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
		pdfScript.onload = function () { clearTimeout(loadTimeout); onReady() }
		pdfScript.onerror = function () {
			clearTimeout(loadTimeout)
			window.alert('Could not load the PDF engine - check your internet connection. Use the Print button instead.')
		}
		document.head.appendChild(pdfScript)
	}

	function pdfFileName(fallbackName) {
		var pageTitle = document.title || fallbackName
		var titleWithoutSuffix = pageTitle.replace(/\s*-\s*(One-Pager|Marketing Presentation|Presentation)\s*$/i, '').trim()
		var titleSlug = titleWithoutSuffix.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
		return (titleSlug || fallbackName) + '.pdf'
	}

	// Print button - opens the browser print dialog with the print CSS.
	var printButton = document.querySelector('.onepager-print')
	if (printButton) {
		printButton.addEventListener('click', function () {
			window.print()
		})
	}

	// Export PDF button - renders the page and downloads a real PDF file.
	var exportButton = document.querySelector('.onepager-export')
	if (exportButton) {
		exportButton.addEventListener('click', function () {
			loadHtml2Pdf(function () {
				var pageElement = document.querySelector('.onepager-page')
				if (!pageElement) return
				document.body.classList.add('onepager-exporting')
				var pdfOptions = {
					margin: [10, 12, 10, 12],
					filename: pdfFileName('onepager'),
					image: { type: 'jpeg', quality: 0.95 },
					html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
					jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
					pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
				}
				window.html2pdf().set(pdfOptions).from(pageElement).save()
					.then(function () { document.body.classList.remove('onepager-exporting') })
					.catch(function (exportError) {
						document.body.classList.remove('onepager-exporting')
						window.alert('PDF export failed: ' + ((exportError && exportError.message) || exportError))
					})
			})
		})
	}

	// Scroll reveal - sections fade up when they enter the viewport.
	var revealItems = Array.prototype.slice.call(document.querySelectorAll('.onepager-reveal'))
	if (revealItems.length === 0) return

	function showAllRevealItems() {
		revealItems.forEach(function (item) { item.classList.add('onepager-reveal-visible') })
	}

	if (!('IntersectionObserver' in window)) {
		showAllRevealItems()
		return
	}

	var revealObserver = new IntersectionObserver(function (entries) {
		entries.forEach(function (entry) {
			if (!entry.isIntersecting) return
			entry.target.classList.add('onepager-reveal-visible')
			revealObserver.unobserve(entry.target)
		})
	}, { threshold: 0.12 })

	revealItems.forEach(function (item) { revealObserver.observe(item) })
})()
