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
	let width = Math.round(element.offsetWidth)
	let height = Math.round(element.offsetHeight)

	if (width > 0 && height === 0) {
		height = width
	}

	const aspectRatio = getComputedStyle(element).aspectRatio
	if (width > 0 && aspectRatio && aspectRatio !== 'auto') {
		const parts = aspectRatio.split('/').map(part => parseFloat(part.trim()))
		if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
			height = Math.round(width * (parts[1] / parts[0]))
		}
	}

	return {width, height}
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

	function observeElement(target: HTMLImageElement): void {
		resizeObserver?.disconnect()
		resizeObserver = null

		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(entries => {
				const entry = lastOf(entries)
				if (!entry) return

				const {width, height} = entry.contentRect
				if (width < 1 || height < 1) return

				layoutWidth = Math.round(width)
				layoutHeight = Math.round(height)
				requestRedraw()
			})
			resizeObserver.observe(target)
		}

		updateLayoutFromElement(target)
		if (lastDrawFn) scheduleDraw(lastDrawFn)
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
				if (!width || !height) return

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
