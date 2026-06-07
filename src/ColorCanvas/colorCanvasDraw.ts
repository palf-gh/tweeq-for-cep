import {whenever} from '@vueuse/core'
import {onBeforeUnmount, type Ref} from 'vue'

import {lastOf} from '../util'
import type {KeyedDrawFn} from './colorRenderers'

const MIN_RENDER_DIMENSION = 4
const MIN_DRAWABLE_LONG_SIDE = 24
const MAX_RENDER_SIZE = 144
const LAYOUT_POLL_FRAMES = 60
const MAX_CACHE_ENTRIES = 24

const renderCache = new Map<string, HTMLCanvasElement>()

type DrawFn = KeyedDrawFn

function cappedRenderSize(width: number, height: number): {width: number; height: number} {
	const longest = Math.max(width, height)
	if (longest <= MAX_RENDER_SIZE) {
		return {
			width: Math.max(MIN_RENDER_DIMENSION, width),
			height: Math.max(MIN_RENDER_DIMENSION, height),
		}
	}

	const scale = MAX_RENDER_SIZE / longest
	return {
		width: Math.max(MIN_RENDER_DIMENSION, Math.round(width * scale)),
		height: Math.max(MIN_RENDER_DIMENSION, Math.round(height * scale)),
	}
}

function heightFromAspectRatio(width: number, aspectRatio: string): number | null {
	if (!aspectRatio || aspectRatio === 'auto') return null

	const parts = aspectRatio.split('/').map(part => parseFloat(part.trim()))
	if (parts.length !== 2 || parts[0] <= 0 || parts[1] <= 0) return null

	return Math.round(width * (parts[1] / parts[0]))
}

function readElementSize(element: HTMLElement): {width: number; height: number} {
	const computed = getComputedStyle(element)
	let width = Math.round(element.clientWidth)
	let height = Math.round(element.clientHeight)

	if (width > 0 && height === 0) {
		const derived = heightFromAspectRatio(width, computed.aspectRatio)
		if (derived) height = derived
	}

	if (width === 0 && height > 0) {
		const derived = heightFromAspectRatio(height, computed.aspectRatio)
		if (derived) width = derived
	}

	if (width > 0 && height === 0) {
		const parsedHeight = parseFloat(computed.height)
		if (parsedHeight > 0) height = Math.round(parsedHeight)
	}

	if (width === 0 && height > 0) {
		const parsedWidth = parseFloat(computed.width)
		if (parsedWidth > 0) width = Math.round(parsedWidth)
	}

	if (width > 0 && height > 0) {
		return {width, height}
	}

	const container = element.parentElement
	if (!container) {
		if (width > 0 && height === 0) height = width
		return {width, height}
	}

	width = Math.round(container.clientWidth)
	height = Math.round(container.clientHeight)

	if (width > 0 && height === 0) {
		const derived = heightFromAspectRatio(
			width,
			getComputedStyle(container).aspectRatio
		)
		if (derived) {
			height = derived
		} else {
			height = width
		}
	}

	return {width, height}
}

function isDrawableSize(width: number, height: number): boolean {
	const longSide = Math.max(width, height)
	const shortSide = Math.min(width, height)
	return shortSide >= MIN_RENDER_DIMENSION && longSide >= MIN_DRAWABLE_LONG_SIDE
}

function getCanvas2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
	const ctx = canvas.getContext('2d')
	return ctx instanceof CanvasRenderingContext2D ? ctx : null
}

function rememberCachedCanvas(key: string, canvas: HTMLCanvasElement): HTMLCanvasElement {
	if (renderCache.size >= MAX_CACHE_ENTRIES) {
		const oldest = renderCache.keys().next().value
		if (oldest) renderCache.delete(oldest)
	}

	renderCache.set(key, canvas)
	return canvas
}

function getCachedCanvas(
	cacheKey: string,
	width: number,
	height: number,
	drawFn: DrawFn
): HTMLCanvasElement {
	const fullKey = `${cacheKey}@${width}x${height}`
	const cached = renderCache.get(fullKey)
	if (cached && cached.width === width && cached.height === height) {
		return cached
	}

	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height

	const ctx = getCanvas2dContext(canvas)
	if (!ctx) return canvas

	drawFn(ctx, width, height)
	return rememberCachedCanvas(fullKey, canvas)
}

export function useColorCanvasDraw(canvasRef: Ref<HTMLCanvasElement | null>) {
	let lastDrawFn: DrawFn | null = null
	let lastCacheKey = ''
	let resizeObserver: ResizeObserver | null = null
	let layoutWidth = 0
	let layoutHeight = 0
	let resizeFrame = 0
	let drawFrame = 0
	let layoutPollFrame = 0
	let layoutPollCount = 0
	let disposed = false
	let element: HTMLCanvasElement | null = null

	function updateLayoutFromElement(target: HTMLElement): boolean {
		const {width, height} = readElementSize(target)
		if (!width || !height) return false

		layoutWidth = width
		layoutHeight = height
		return true
	}

	function requestRedraw(): void {
		cancelAnimationFrame(resizeFrame)
		resizeFrame = requestAnimationFrame(() => {
			if (lastDrawFn) scheduleDraw(lastDrawFn)
		})
	}

	function stopLayoutPolling(): void {
		cancelAnimationFrame(layoutPollFrame)
		layoutPollFrame = 0
		layoutPollCount = 0
	}

	function startLayoutPolling(target: HTMLCanvasElement): void {
		if (typeof ResizeObserver !== 'undefined') return

		stopLayoutPolling()

		const tick = () => {
			if (disposed || !target.isConnected) {
				stopLayoutPolling()
				return
			}

			layoutPollCount += 1
			if (updateLayoutFromElement(target) && isDrawableSize(layoutWidth, layoutHeight)) {
				requestRedraw()
				stopLayoutPolling()
				return
			}

			if (layoutPollCount < LAYOUT_POLL_FRAMES) {
				layoutPollFrame = requestAnimationFrame(tick)
			}
		}

		layoutPollFrame = requestAnimationFrame(tick)
	}

	function observeElement(target: HTMLCanvasElement): void {
		resizeObserver?.disconnect()
		resizeObserver = null
		stopLayoutPolling()

		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(entries => {
				const entry = lastOf(entries)
				if (!entry) return

				const sized = readElementSize(entry.target as HTMLElement)
				if (!isDrawableSize(sized.width, sized.height)) return

				layoutWidth = sized.width
				layoutHeight = sized.height
				requestRedraw()
			})
			resizeObserver.observe(target)
		} else {
			startLayoutPolling(target)
		}

		updateLayoutFromElement(target)
		if (lastDrawFn && isDrawableSize(layoutWidth, layoutHeight)) {
			scheduleDraw(lastDrawFn)
		}
	}

	whenever(
		canvasRef,
		nextElement => {
			if (!nextElement) {
				element = null
				return
			}

			element = nextElement
			observeElement(nextElement)
		},
		{immediate: true, flush: 'sync'}
	)

	onBeforeUnmount(() => {
		disposed = true
		cancelAnimationFrame(resizeFrame)
		cancelAnimationFrame(drawFrame)
		stopLayoutPolling()
		resizeObserver?.disconnect()
		resizeObserver = null
		lastDrawFn = null
		element = null
	})

	function paint(drawFn: DrawFn): void {
		try {
			const target = element
			if (!target || !target.isConnected) return

			const measured = readElementSize(target)
			const layoutW = layoutWidth || measured.width
			const layoutH = layoutHeight || measured.height
			if (!isDrawableSize(layoutW, layoutH)) return

			const {width, height} = cappedRenderSize(layoutW, layoutH)
			const cached = getCachedCanvas(drawFn.cacheKey, width, height, drawFn)
			const ctx = getCanvas2dContext(target)
			if (!ctx) return

			target.width = width
			target.height = height
			ctx.drawImage(cached, 0, 0)
		} catch (error) {
			// Keep Vue's render tree intact on legacy runtimes (e.g. AE CEP).
			// eslint-disable-next-line no-console
			console.error('[ColorCanvas] draw failed:', error)
		}
	}

	function scheduleDraw(drawFn: DrawFn): void {
		if (disposed) return

		const cacheKeyChanged = drawFn.cacheKey !== lastCacheKey
		lastDrawFn = drawFn
		lastCacheKey = drawFn.cacheKey

		if (cacheKeyChanged) {
			cancelAnimationFrame(drawFrame)
			drawFrame = 0
		}

		if (drawFrame) return

		drawFrame = requestAnimationFrame(() => {
			drawFrame = 0
			if (!lastDrawFn) return
			paint(lastDrawFn)
		})
	}

	return scheduleDraw
}
