import {whenever} from '@vueuse/core'
import {uniqueId} from 'lodash-es'
import {onBeforeUnmount, type Ref} from 'vue'

import {lastOf} from '../util'
import {
	renderPad,
	renderSlider,
	renderWheel,
	type PadUniforms,
	type SliderUniforms,
} from './colorRenderers'

type DrawFn = (ctx: CanvasRenderingContext2D, width: number, height: number) => void

const MIN_CANVAS_SIZE = 32
const LAYOUT_POLL_FRAMES = 120

const offscreen = document.createElement('canvas')
let drawChain = Promise.resolve()

function enqueueDraw(task: () => void): void {
	drawChain = drawChain
		.then(() => {
			task()
		})
		.catch(() => {})
}

function readElementSize(element: HTMLElement): {width: number; height: number} {
	const container = element.parentElement ?? element
	let width = Math.round(container.clientWidth)
	let height = Math.round(container.clientHeight)

	if (width > 0 && height === 0) {
		height = width
	}

	const aspectRatio = getComputedStyle(container).aspectRatio
	if (width > 0 && aspectRatio && aspectRatio !== 'auto') {
		const parts = aspectRatio.split('/').map(part => parseFloat(part.trim()))
		if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
			height = Math.round(width * (parts[1] / parts[0]))
		}
	}

	return {width, height}
}

function isDrawableSize(width: number, height: number): boolean {
	return width >= MIN_CANVAS_SIZE && height >= MIN_CANVAS_SIZE
}

function getCanvas2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
	const ctx = canvas.getContext('2d')
	return ctx instanceof CanvasRenderingContext2D ? ctx : null
}

export function useColorCanvasDraw(img: Ref<HTMLImageElement | null>) {
	let latestWorkId = uniqueId()
	let lastDrawFn: DrawFn | null = null
	let resizeObserver: ResizeObserver | null = null
	let layoutWidth = 0
	let layoutHeight = 0
	let resizeFrame = 0
	let layoutPollFrame = 0
	let layoutPollCount = 0
	let disposed = false
	let element: HTMLImageElement | null = null

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

	function startLayoutPolling(target: HTMLImageElement): void {
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

	function observeElement(target: HTMLImageElement): void {
		resizeObserver?.disconnect()
		resizeObserver = null
		stopLayoutPolling()

		const container = target.parentElement ?? target

		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(entries => {
				const entry = lastOf(entries)
				if (!entry) return

				const {width, height} = entry.contentRect
				if (!isDrawableSize(width, height)) return

				layoutWidth = Math.round(width)
				layoutHeight = Math.round(height)
				requestRedraw()
			})
			resizeObserver.observe(container)
		} else {
			startLayoutPolling(target)
		}

		updateLayoutFromElement(target)
		if (lastDrawFn && isDrawableSize(layoutWidth, layoutHeight)) {
			scheduleDraw(lastDrawFn)
		}
	}

	whenever(
		img,
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
		stopLayoutPolling()
		resizeObserver?.disconnect()
		resizeObserver = null
		lastDrawFn = null
		element = null
	})

	function scheduleDraw(drawFn: DrawFn): void {
		if (disposed) return

		lastDrawFn = drawFn
		const workId = uniqueId()
		latestWorkId = workId

		enqueueDraw(() => {
			try {
				if (disposed || latestWorkId !== workId) return

				const target = element
				if (!target || !target.isConnected) return

				const measured = readElementSize(target)
				const width = layoutWidth || measured.width
				const height = layoutHeight || measured.height
				if (!isDrawableSize(width, height)) return

				offscreen.width = width
				offscreen.height = height

				const ctx = getCanvas2dContext(offscreen)
				if (!ctx) return

				drawFn(ctx, width, height)

				if (disposed || latestWorkId !== workId || !target.isConnected) {
					return
				}

				target.src = offscreen.toDataURL()
			} catch (error) {
				// Keep Vue's render tree intact on legacy runtimes (e.g. AE CEP).
				// eslint-disable-next-line no-console
				console.error('[ColorCanvas] draw failed:', error)
			}
		})
	}

	return scheduleDraw
}

export function createPadDraw(uniforms: PadUniforms): DrawFn {
	return (ctx, width, height) => {
		renderPad(ctx, width, height, uniforms.hsva, uniforms.axes)
	}
}

export function createSliderDraw(uniforms: SliderUniforms): DrawFn {
	return (ctx, width, height) => {
		renderSlider(ctx, width, height, uniforms.hsva, uniforms.axis, uniforms.offset ?? 0)
	}
}

export function createWheelDraw(): DrawFn {
	return (ctx, width, height) => {
		renderWheel(ctx, width, height)
	}
}
