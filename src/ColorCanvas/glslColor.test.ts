import {describe, expect, it} from 'vitest'

import {
	computePadColor,
	computeSliderColor,
	computeWheelColor,
	glslHsv2rgb,
	glslRgb2hsv,
	pixelToUv,
} from './glslColor'

describe('glslHsv2rgb', () => {
	it('matches pure red at hue 0', () => {
		const [r, g, b] = glslHsv2rgb(0, 1, 1)
		expect(r).toBeCloseTo(1, 5)
		expect(g).toBeCloseTo(0, 5)
		expect(b).toBeCloseTo(0, 5)
	})
})

describe('glslRgb2hsv', () => {
	it('returns zero saturation for black', () => {
		const [, s, v] = glslRgb2hsv(0, 0, 0)
		expect(s).toBeCloseTo(0, 5)
		expect(v).toBeCloseTo(0, 5)
	})
})

describe('pixelToUv', () => {
	it('maps top-left to (0, 1)', () => {
		expect(pixelToUv(0, 0, 100, 100)).toEqual([0, 1])
	})

	it('maps bottom-right to (1, 0)', () => {
		expect(pixelToUv(99, 99, 100, 100)).toEqual([1, 0])
	})
})

describe('computePadColor', () => {
	it('renders bright red at top-right of an SV pad', () => {
		const color = computePadColor([1, 1], [0, 0.5, 0.5, 1], [5, 6])
		expect(color.r).toBeCloseTo(1, 2)
		expect(color.g).toBeGreaterThanOrEqual(0)
		expect(color.b).toBeGreaterThanOrEqual(0)
		expect(color.g).toBeLessThan(0.05)
		expect(color.b).toBeLessThan(0.05)
	})

	it('renders black at bottom-left of an SV pad', () => {
		const color = computePadColor([0, 0], [0, 0.5, 0.5, 1], [5, 6])
		expect(color.r).toBeCloseTo(0, 2)
		expect(color.g).toBeCloseTo(0, 2)
		expect(color.b).toBeCloseTo(0, 2)
	})

	it('renders white at top-left of an SV pad for a saturated hue', () => {
		const color = computePadColor([0, 1], [0, 1, 1, 1], [5, 6])
		expect(color.r).toBeCloseTo(1, 2)
		expect(color.g).toBeCloseTo(1, 2)
		expect(color.b).toBeCloseTo(1, 2)
	})
})

describe('computeSliderColor', () => {
	it('varies alpha without changing rgb on the alpha slider', () => {
		const opaque = computeSliderColor(1, [0.5, 1, 1, 1], 3)
		const transparent = computeSliderColor(0, [0.5, 1, 1, 1], 3)
		expect(opaque.a).toBeCloseTo(1, 5)
		expect(transparent.a).toBeCloseTo(0, 5)
		expect(opaque.r).toBeCloseTo(transparent.r, 5)
	})

	it('shows a red hue at the start of the hue slider', () => {
		const left = computeSliderColor(0, [0, 1, 1, 1], 4)
		expect(left.r).toBeCloseTo(1, 2)
		expect(left.g).toBeCloseTo(0, 2)
		expect(left.b).toBeCloseTo(0, 2)
	})
})

describe('computeWheelColor', () => {
	it('places red at the top of the wheel', () => {
		const top = computeWheelColor([0.5, 1])
		expect(top.r).toBeCloseTo(1, 2)
		expect(top.g).toBeCloseTo(0, 2)
	})
})
