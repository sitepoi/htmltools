/* ── Presentation shared behavior (all features) ────────────────────────────
   Used by every <feature>/_presentation.html. One slide visible at a time:
   prev/next buttons, keyboard arrows, progress bar, counter, deep links
   (#slide-3) and an Export PDF button (html2canvas + html2pdf loaded on
   demand, one slide per page). No per-document scripts allowed. */
(function () {
	'use strict'

	var slides = Array.prototype.slice.call(document.querySelectorAll('.pres-slide'))
	if (slides.length === 0) return

	var currentSlide = 0
	var progressBar = document.querySelector('.pres-progress')
	var slideCounter = document.querySelector('.pres-counter')
	var previousButton = document.querySelector('.pres-nav-prev')
	var nextButton = document.querySelector('.pres-nav-next')

	function renderCurrentSlide() {
		slides.forEach(function (slide, index) {
			slide.style.display = index === currentSlide ? 'flex' : 'none'
		})
		if (progressBar) progressBar.style.width = Math.round(((currentSlide + 1) / slides.length) * 100) + '%'
		if (slideCounter) slideCounter.textContent = (currentSlide + 1) + ' / ' + slides.length
		if (previousButton) previousButton.disabled = currentSlide === 0
		if (nextButton) nextButton.disabled = currentSlide === slides.length - 1
		if (window.location.hash !== '#slide-' + (currentSlide + 1)) {
			try { window.history.replaceState(null, '', '#slide-' + (currentSlide + 1)) } catch (_e) { /* file protocol */ }
		}
	}

	function goToSlide(slideIndex) {
		if (slideIndex < 0 || slideIndex >= slides.length) return
		currentSlide = slideIndex
		renderCurrentSlide()
		slides[currentSlide].scrollIntoView({ behavior: 'smooth', block: 'start' })
	}

	function stepSlide(delta) { goToSlide(currentSlide + delta) }

	if (previousButton) previousButton.addEventListener('click', function () { stepSlide(-1) })
	if (nextButton) nextButton.addEventListener('click', function () { stepSlide(1) })

	document.addEventListener('keydown', function (keyEvent) {
		if (keyEvent.key === 'ArrowRight' || keyEvent.key === 'PageDown') { stepSlide(1) }
		else if (keyEvent.key === 'ArrowLeft' || keyEvent.key === 'PageUp') { stepSlide(-1) }
	})

	function loadPdfEngines(onReady) {
		if (window.html2pdf && window.html2canvas) { onReady(); return }
		var pendingLoads = 0
		var loadFailed = false
		var loadTimeout = setTimeout(function () {
			if (loadFailed) return
			loadFailed = true
			window.alert('The PDF engine is taking too long - check your internet connection, then try again.')
		}, 12000)
		function markEngineLoaded() {
			pendingLoads -= 1
			if (loadFailed) return
			if (pendingLoads === 0) {
				clearTimeout(loadTimeout)
				onReady()
			}
		}
		function markEngineFailed() {
			if (loadFailed) return
			loadFailed = true
			clearTimeout(loadTimeout)
			window.alert('Could not load the PDF engine - check your internet connection. Use Print instead.')
		}
		function injectEngineScript(scriptSource, onScriptLoaded) {
			var scriptElement = document.createElement('script')
			scriptElement.src = scriptSource
			scriptElement.onload = onScriptLoaded
			scriptElement.onerror = markEngineFailed
			document.head.appendChild(scriptElement)
		}
		// html2canvas renders each slide to a canvas; html2pdf is used ONLY
		// to create the jsPDF document - its own clone-and-slice pipeline
		// is never used for capture.
		if (!window.html2canvas) {
			pendingLoads += 1
			injectEngineScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', markEngineLoaded)
		}
		if (!window.html2pdf) {
			pendingLoads += 1
			injectEngineScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', markEngineLoaded)
		}
		if (pendingLoads === 0) {
			clearTimeout(loadTimeout)
			onReady()
		}
	}

	function pdfFileName(fallbackName) {
		var pageTitle = document.title || fallbackName
		var titleWithoutSuffix = pageTitle.replace(/\s*-\s*(One-Pager|Marketing Presentation|Presentation)\s*$/i, '').trim()
		var titleSlug = titleWithoutSuffix.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
		return (titleSlug || fallbackName) + '.pdf'
	}

	// Export PDF - renders each slide separately into its own exact
	// 297 x 167 mm page and assembles them into one PDF. Per-slide
	// rendering avoids the slicing bugs of the one-tall-canvas approach
	// (content spill and horizontal shifts).
	var exportButton = document.querySelector('.pres-nav-export')
	if (exportButton) {
		exportButton.addEventListener('click', function () {
			loadPdfEngines(function () {
				document.body.classList.add('pres-exporting')
				var slideElements = Array.prototype.slice.call(document.querySelectorAll('.pres-slide'))
				var baseOptions = {
					margin: 0,
					image: { type: 'jpeg', quality: 0.95 },
					html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 1130 },
					// NOTE: orientation: 'landscape' WITH the [297, 167] array is
					// correct - jsPDF's _addPage keeps the array as-is when the
					// shape already matches the orientation, so the real page is
					// 297 x 167 mm landscape. The explicit pageSize below is
					// REQUIRED: jsPDF.getPageSize() (used by html2pdf) swaps the
					// array for landscape and would report 167 x 297, drawing
					// the image into the left strip of the page.
					jsPDF: { unit: 'mm', format: [297, 167], orientation: 'landscape', compress: true },
					pageSize: { width: 297, height: 167, unit: 'mm', k: 96 / 25.4 },
				}
				var pdfDocument = null

				// Collects the real text of every block element in the rendered
				// shell, with positions measured relative to the shell and
				// scaled to PDF millimetres. Direct text nodes only - nested
				// blocks are collected on their own, so nothing is duplicated.
				function collectSlideTextBlocks(exportShell) {
					var blockSelector = '.pres-kicker, h1, h2, h3, p, li, th, td, cite, .pres-chip, .pres-btn'
					var collectedElements = Array.prototype.slice.call(exportShell.querySelectorAll(blockSelector))
					var shellRect = exportShell.getBoundingClientRect()
					var textBlocks = []
					collectedElements.forEach(function (element) {
						var directText = ''
						for (var nodeIndex = 0; nodeIndex < element.childNodes.length; nodeIndex++) {
							if (element.childNodes[nodeIndex].nodeType === 3) directText += element.childNodes[nodeIndex].nodeValue
						}
						directText = directText.replace(/\s+/g, ' ').trim()
						if (!directText) return
						var elementRect = element.getBoundingClientRect()
						var fontSizePx = parseFloat(window.getComputedStyle(element).fontSize) || 16
						textBlocks.push({
							text: directText,
							xMm: (elementRect.left - shellRect.left) / 1122.52 * 297,
							yMm: (elementRect.top - shellRect.top) / 631.18 * 167,
							widthMm: elementRect.width / 1122.52 * 297,
							fontSizePt: fontSizePx / 1122.52 * 297 * 72 / 25.4,
						})
					})
					return textBlocks
				}

				// Draws the slide's real text over the page image with PDF
				// rendering mode 3 (invisible): nothing is painted, but the
				// text is real PDF text - selectable in viewers and indexable
				// by search engines.
				function addInvisibleTextLayer(pdf, textBlocks) {
					textBlocks.forEach(function (block) {
						pdf.setFontSize(block.fontSizePt)
						pdf.text(block.text, block.xMm, block.yMm + block.fontSizePt * 0.28, {
							maxWidth: block.widthMm,
							renderingMode: 'invisible',
						})
					})
				}

				function renderSlide(slideIndex) {
					if (slideIndex >= slideElements.length) {
						if (pdfDocument) {
							if (window.console && console.log) {
								console.log('PDF exported: ' + pdfDocument.internal.getNumberOfPages() + ' pages, page size '
									+ pdfDocument.internal.pageSize.getWidth() + ' x ' + pdfDocument.internal.pageSize.getHeight() + ' mm')
							}
							pdfDocument.save(pdfFileName('presentation'))
						}
						document.body.classList.remove('pres-exporting')
						return
					}
					// Render the slide inside our own off-screen shell with the
					// exact PDF page size, captured DIRECTLY with html2canvas.
					// html2pdf's clone pipeline is not used for capture: its
					// container sizing and page math produced sliced, shifted,
					// and half-width renders. The shell is 1122.52 x 631.18 px,
					// which is exactly 297 x 167 mm at 96 dpi.
					var exportShell = document.createElement('div')
					exportShell.style.cssText = 'position: fixed; left: -10000px; top: 0;'
						+ ' width: 1122.52px; height: 631.18px;'
						+ ' overflow: hidden; background: #ffffff;'
					var slideClone = slideElements[slideIndex].cloneNode(true)
					slideClone.style.cssText += '; display: flex !important; width: 100% !important; height: 100% !important;'
						+ ' min-height: 0 !important; aspect-ratio: auto !important; margin: 0 !important;'
						+ ' box-sizing: border-box !important; border-radius: 0 !important; box-shadow: none !important;'
						+ ' animation: none !important;'
					exportShell.appendChild(slideClone)
					document.body.appendChild(exportShell)
					window.html2canvas(exportShell, {
						scale: 2,
						useCORS: true,
						backgroundColor: '#ffffff',
						windowWidth: 1130,
					}).then(function (slideCanvas) {
						var slideTextBlocks = collectSlideTextBlocks(exportShell)
						if (exportShell.parentNode) exportShell.parentNode.removeChild(exportShell)
						if (!slideCanvas) throw new Error('the slide rendered as an empty image')
						var imageDataUrl = slideCanvas.toDataURL('image/jpeg', 0.95)
						if (!imageDataUrl || imageDataUrl.indexOf('data:image') !== 0) {
							throw new Error('the slide rendered as an empty image')
						}
						if (slideIndex === 0) {
							// Seed a PDF object from html2pdf using OUR canvas
							// (injected directly - no clone, no capture). Then
							// discard its page slicing and draw page 1 ourselves.
							return window.html2pdf().set(baseOptions).set({ canvas: slideCanvas }).toPdf().get('pdf').then(function (firstPdf) {
								pdfDocument = firstPdf
								// html2pdf slices the canvas into pages with floor()
								// math, so a sub-pixel remainder can spawn a stray
								// blank page. Drop every page after the first and
								// draw page 1 ourselves at the exact page size.
								while (pdfDocument.internal.getNumberOfPages() > 1) {
									pdfDocument.deletePage(pdfDocument.internal.getNumberOfPages())
								}
								pdfDocument.setPage(1)
								pdfDocument.addImage(imageDataUrl, 'JPEG', 0, 0, 297, 167)
								pdfDocument.setProperties({
									title: (document.title || 'Presentation').trim(),
									subject: 'Marketing presentation',
									creator: 'SitePoiCMS',
								})
								addInvisibleTextLayer(pdfDocument, slideTextBlocks)
								renderSlide(slideIndex + 1)
							})
						}
						pdfDocument.addPage([297, 167], 'landscape')
						pdfDocument.addImage(imageDataUrl, 'JPEG', 0, 0, 297, 167)
						addInvisibleTextLayer(pdfDocument, slideTextBlocks)
						renderSlide(slideIndex + 1)
					}).catch(function (exportError) {
						if (exportShell.parentNode) exportShell.parentNode.removeChild(exportShell)
						document.body.classList.remove('pres-exporting')
						window.alert('PDF export failed: ' + ((exportError && exportError.message) || exportError))
					})
				}

				renderSlide(0)
			})
		})
	}

	var hashMatch = window.location.hash.match(/slide-(\d+)/)
	var startSlide = hashMatch
		? Math.max(0, Math.min(parseInt(hashMatch[1], 10) - 1, slides.length - 1))
		: 0
	goToSlide(startSlide)
})()
