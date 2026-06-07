import {
	computePadColor,
	computeSliderColor,
	computeWheelColor,
	pixelToUv,
} from './glslColor'

export type HSVAUniform = readonly [number, number, number, number]

export interface PadUniforms {
	hsva: HSVAUniform
	axes: readonly [number, number]
}

export interface SliderUniforms {
	hsva: HSVAUniform
	axis: number
	offset?: number
}

export interface WheelUniforms {
	hsva: HSVAUniform
}

type RGBA = {r: number; g: number; b: number; a: number}

function putPixel(
	data: Uint8ClampedArray,
	index: number,
	color: RGBA
): void {
	data[index] = Math.round(clamp01(color.r) * 255)
	data[index + 1] = Math.round(clamp01(color.g) * 255)
	data[index + 2] = Math.round(clamp01(color.b) * 255)
	data[index + 3] = Math.round(clamp01(color.a) * 255)
}

function clamp01(x: number): number {
	return Math.min(1, Math.max(0, x))
}

export function renderPad(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	hsva: readonly [number, number, number, number],
	axes: readonly [number, number]
): void {
	const imageData = ctx.createImageData(width, height)
	const {data} = imageData

	for (let py = 0; py < height; py++) {
		for (let px = 0; px < width; px++) {
			const uv = pixelToUv(px, py, width, height)
			const color = computePadColor(uv, hsva, axes)
			putPixel(data, (py * width + px) * 4, color)
		}
	}

	ctx.putImageData(imageData, 0, 0)
}

export function renderSlider(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	hsva: readonly [number, number, number, number],
	axis: number,
	offset = 0
): void {
	const imageData = ctx.createImageData(width, height)
	const {data} = imageData

	for (let py = 0; py < height; py++) {
		for (let px = 0; px < width; px++) {
			const [u] = pixelToUv(px, py, width, height)
			const color = computeSliderColor(u + offset, hsva, axis)
			putPixel(data, (py * width + px) * 4, color)
		}
	}

	ctx.putImageData(imageData, 0, 0)
}

export function renderWheel(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number
): void {
	const imageData = ctx.createImageData(width, height)
	const {data} = imageData

	for (let py = 0; py < height; py++) {
		for (let px = 0; px < width; px++) {
			const uv = pixelToUv(px, py, width, height)
			const color = computeWheelColor(uv)
			putPixel(data, (py * width + px) * 4, color)
		}
	}

	ctx.putImageData(imageData, 0, 0)
}
