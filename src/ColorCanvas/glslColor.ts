// Colour conversions ported from the original GLSL fragment shaders.

const NONE = -1

function fract(x: number): number {
	return x - Math.floor(x)
}

function mix(a: number, b: number, t: number): number {
	return a * (1 - t) + b * t
}

function clamp(x: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, x))
}

function step(edge: number, x: number): number {
	return x < edge ? 0 : 1
}

function clamp01(x: number): number {
	return Math.min(1, Math.max(0, x))
}

export function glslHsv2rgb(h: number, s: number, v: number): [number, number, number] {
	const K = [1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0] as const
	const p = [
		Math.abs(fract(h + K[0]) * 6.0 - K[3]),
		Math.abs(fract(h + K[1]) * 6.0 - K[3]),
		Math.abs(fract(h + K[2]) * 6.0 - K[3]),
	] as const

	return [
		clamp01(v * mix(K[0], clamp(p[0] - K[0], 0, 1), s)),
		clamp01(v * mix(K[0], clamp(p[1] - K[0], 0, 1), s)),
		clamp01(v * mix(K[0], clamp(p[2] - K[0], 0, 1), s)),
	]
}

export function glslRgb2hsv(r: number, g: number, b: number): [number, number, number] {
	const K = [0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0] as const
	const p = mixVec4(
		[b, g, K[3], K[2]],
		[g, b, K[0], K[1]],
		step(b, g)
	)
	const q = mixVec4(
		[p[0], p[1], p[3], r],
		[r, p[1], p[2], p[0]],
		step(p[0], r)
	)
	const d = q[0] - Math.min(q[3], q[2])
	const e = 1.0e-10

	return [
		Math.abs(q[1] + (q[3] - q[2]) / (6.0 * d + e)),
		d / (q[0] + e),
		q[0],
	]
}

function mixVec4(
	a: readonly [number, number, number, number],
	b: readonly [number, number, number, number],
	t: number
): [number, number, number, number] {
	return [
		mix(a[0], b[0], t),
		mix(a[1], b[1], t),
		mix(a[2], b[2], t),
		mix(a[3], b[3], t),
	]
}

type RGBA = {r: number; g: number; b: number; a: number}

export function computePadColor(
	uv: readonly [number, number],
	hsva: readonly [number, number, number, number],
	axes: readonly [number, number]
): RGBA {
	let hue = NONE
	let sat = NONE

	const [r, g, b] = glslHsv2rgb(hsva[0], hsva[1], hsva[2])
	const outColor: RGBA = {r, g, b, a: 1}

	for (let i = 0; i < 2; i++) {
		const axis = axes[i]
		const t = uv[i]

		if (axis === 0) {
			outColor.r = t
		} else if (axis === 1) {
			outColor.g = t
		} else if (axis === 2) {
			outColor.b = t
		} else if (axis === 3) {
			outColor.a = t
		} else {
			let hsv = glslRgb2hsv(outColor.r, outColor.g, outColor.b)

			if (hsv[1] === 0 || hsv[2] === 0) {
				hsv = [
					hue === NONE ? hsva[0] : hue,
					sat === NONE ? hsva[1] : sat,
					hsv[2],
				]
			}

			if (axis === 4) {
				hsv[0] = t
				hue = t
			} else if (axis === 5) {
				hsv[1] = t
				sat = t
			} else if (axis === 6) {
				hsv[2] = t
			}

			const [nr, ng, nb] = glslHsv2rgb(hsv[0], hsv[1], hsv[2])
			outColor.r = nr
			outColor.g = ng
			outColor.b = nb
		}
	}

	return outColor
}

export function computeSliderColor(
	t: number,
	hsva: readonly [number, number, number, number],
	axis: number
): RGBA {
	const [r, g, b] = glslHsv2rgb(hsva[0], hsva[1], hsva[2])
	const outColor: RGBA = {r, g, b, a: 1}

	if (axis === 0) {
		outColor.r = t
	} else if (axis === 1) {
		outColor.g = t
	} else if (axis === 2) {
		outColor.b = t
	} else if (axis === 3) {
		outColor.a = t
	} else {
		let hsv: [number, number, number] = [hsva[0], hsva[1], hsva[2]]
		if (axis === 4) {
			hsv = [t, 1, 1]
		} else if (axis === 5) {
			hsv[1] = t
		} else if (axis === 6) {
			hsv[2] = t
		}
		const [nr, ng, nb] = glslHsv2rgb(hsv[0], hsv[1], hsv[2])
		outColor.r = nr
		outColor.g = ng
		outColor.b = nb
	}

	return outColor
}

export function computeWheelColor(uv: readonly [number, number]): RGBA {
	const pos: [number, number] = [uv[0] * 2 - 1, uv[1] * 2 - 1]
	const hue = Math.atan2(pos[0], pos[1]) / (2 * Math.PI)
	const [r, g, b] = glslHsv2rgb(hue, 1, 1)

	return {r, g, b, a: 1}
}

/** Map canvas pixel coordinates to GLSL-style UV (y = 0 at bottom). */
export function pixelToUv(
	px: number,
	py: number,
	width: number,
	height: number
): [number, number] {
	const u = width > 1 ? px / (width - 1) : 0
	const v = height > 1 ? 1 - py / (height - 1) : 1
	return [u, v]
}
