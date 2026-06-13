import {
	computePadColor,
	computeSliderColor,
	computeWheelColor,
	glslHsv2rgb,
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
	vertical?: boolean
}

export interface WheelUniforms {
	hsva: HSVAUniform
}

export type ColorCanvasType = 'pad' | 'slider' | 'wheel'

type RGBA = {r: number; g: number; b: number; a: number}

export interface KeyedDrawFn {
	(ctx: CanvasRenderingContext2D, width: number, height: number): void
	cacheKey: string
}

function putPixel(data: Uint8ClampedArray, index: number, color: RGBA): void {
	data[index] = Math.round(clamp01(color.r) * 255)
	data[index + 1] = Math.round(clamp01(color.g) * 255)
	data[index + 2] = Math.round(clamp01(color.b) * 255)
	data[index + 3] = Math.round(clamp01(color.a) * 255)
}

function clamp01(x: number): number {
	return Math.min(1, Math.max(0, x))
}

function isSVPad(axes: readonly [number, number]): boolean {
	return axes[0] === 5 && axes[1] === 6
}

export function buildRenderCacheKey(
	type: ColorCanvasType,
	uniforms?: PadUniforms | SliderUniforms | WheelUniforms
): string {
	if (type === 'wheel') return 'wheel'

	if (!uniforms) return `${type}:empty`

	if (type === 'pad') {
		const pad = uniforms as PadUniforms
		if (isSVPad(pad.axes)) {
			return `pad:sv:${pad.hsva[0].toFixed(5)}`
		}

		return `pad:${pad.hsva.join(',')}:${pad.axes.join(',')}`
	}

	const slider = uniforms as SliderUniforms
	const {hsva, axis, offset = 0} = slider

	if (axis === 4) {
		return `slider:h:${slider.vertical ? 'v' : 'h'}:${offset.toFixed(5)}`
	}

	if (axis === 5) {
		return `slider:s:${hsva[0].toFixed(5)}:${hsva[2].toFixed(5)}:${offset.toFixed(5)}`
	}

	if (axis === 6) {
		return `slider:v:${hsva[0].toFixed(5)}:${hsva[1].toFixed(5)}:${offset.toFixed(5)}`
	}

	return `slider:${axis}:${hsva.join(',')}:${offset.toFixed(5)}`
}

function renderSVPad(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	hue: number
): void {
	for (let py = 0; py < height; py++) {
		const v = height > 1 ? 1 - py / (height - 1) : 1
		const row = py * width * 4

		for (let px = 0; px < width; px++) {
			const u = width > 1 ? px / (width - 1) : 0
			const [r, g, b] = glslHsv2rgb(hue, u, v)
			const index = row + px * 4
			data[index] = Math.round(r * 255)
			data[index + 1] = Math.round(g * 255)
			data[index + 2] = Math.round(b * 255)
			data[index + 3] = 255
		}
	}
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

	if (isSVPad(axes)) {
		renderSVPad(data, width, height, hsva[0])
		ctx.putImageData(imageData, 0, 0)
		return
	}

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
	offset = 0,
	vertical = false
): void {
	const imageData = ctx.createImageData(width, height)
	const {data} = imageData

	if (vertical) {
		for (let py = 0; py < height; py++) {
			const u = height > 1 ? 1 - py / (height - 1) : 1
			const color = computeSliderColor(u + offset, hsva, axis)
			const row = py * width * 4

			for (let px = 0; px < width; px++) {
				putPixel(data, row + px * 4, color)
			}
		}
	} else {
		for (let px = 0; px < width; px++) {
			const u = width > 1 ? px / (width - 1) : 0
			const color = computeSliderColor(u + offset, hsva, axis)
			const base = px * 4

			for (let py = 0; py < height; py++) {
				putPixel(data, py * width * 4 + base, color)
			}
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

export function createPadDraw(uniforms: PadUniforms): KeyedDrawFn {
	const draw: KeyedDrawFn = (ctx, width, height) => {
		renderPad(ctx, width, height, uniforms.hsva, uniforms.axes)
	}
	draw.cacheKey = buildRenderCacheKey('pad', uniforms)
	return draw
}

export function createSliderDraw(uniforms: SliderUniforms): KeyedDrawFn {
	const draw: KeyedDrawFn = (ctx, width, height) => {
		renderSlider(
			ctx,
			width,
			height,
			uniforms.hsva,
			uniforms.axis,
			uniforms.offset ?? 0,
			uniforms.vertical ?? false
		)
	}
	draw.cacheKey = buildRenderCacheKey('slider', uniforms)
	return draw
}

export function createWheelDraw(): KeyedDrawFn {
	const draw: KeyedDrawFn = (ctx, width, height) => {
		renderWheel(ctx, width, height)
	}
	draw.cacheKey = buildRenderCacheKey('wheel')
	return draw
}
