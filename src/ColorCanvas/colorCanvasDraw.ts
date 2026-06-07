import {whenever} from '@vueuse/core'
import {uniqueId} from 'lodash-es'
import {onBeforeUnmount, type Ref} from 'vue'

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

function enqueueDraw(task: () => Promise<void>): void {
	drawChain = drawChain.then(task).catch(() => {})
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

export function useColorCanvasDraw(img: Ref<HTMLImageElement | null>) {
	let latestWorkId = uniqueId()
	let lastDrawFn: DrawFn | null = null
	let resizeObserver: ResizeObserver | null = null
	let layoutWidth = 0
	let layoutHeight = 0
	let resizeFrame = 0
	let disposed = false

	const {promise: waitTillMounted, resolve} = (
		Promise as typeof Promise & {
			withResolvers: <T>() => {
				promise: Promise<T>
				resolve: (value: T) => void
			}
		}
	).withResolvers<HTMLImageElement>()

	whenever(
		img,
		element => {
			if (!element) return
			resolve(element)

			resizeObserver?.disconnect()
			resizeObserver = new ResizeObserver(entries => {
				const entry = entries.at(-1)
				if (!entry) return

				const {width, height} = entry.contentRect
				if (width < 1 || height < 1) return

				layoutWidth = Math.round(width)
				layoutHeight = Math.round(height)

				cancelAnimationFrame(resizeFrame)
				resizeFrame = requestAnimationFrame(() => {
					if (lastDrawFn) scheduleDraw(lastDrawFn)
				})
			})
			resizeObserver.observe(element)
		},
		{immediate: true, flush: 'sync'}
	)

	onBeforeUnmount(() => {
		disposed = true
		cancelAnimationFrame(resizeFrame)
		resizeObserver?.disconnect()
		resizeObserver = null
		lastDrawFn = null
	})

	function scheduleDraw(drawFn: DrawFn): void {
		if (disposed) return

		lastDrawFn = drawFn
		const workId = uniqueId()
		latestWorkId = workId

		enqueueDraw(async () => {
			if (disposed || latestWorkId !== workId) return

			const element = await waitTillMounted
			if (disposed || !element.isConnected) return

			const measured = readElementSize(element)
			const width = layoutWidth || measured.width
			const height = layoutHeight || measured.height
			if (!width || !height) return

			offscreen.width = width
			offscreen.height = height

			const ctx = offscreen.getContext('2d', {alpha: true})
			if (!ctx) return

			drawFn(ctx, width, height)

			if (disposed || !element.isConnected) return
			element.src = offscreen.toDataURL()
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
