import type {StyleValue} from 'vue'

/** CEF-safe scrub overlay styling (no CSS pow() / color-mix()). */
export function scrubScaleStyle(
	precision: number,
	offsetWeight: number,
	dashoffset: number,
	opacity: number
): StyleValue {
	const dashGap = Math.max(1, Math.pow(10, precision))
	const strokeWidth = Math.max(1, 4 + offsetWeight * -1)
	const mix = Math.min(1, Math.max(0, offsetWeight / 2))
	const r = Math.round(154 + (130 - 154) * mix)
	const g = Math.round(208 + (155 - 208) * mix)
	const b = Math.round(255 + (185 - 255) * mix)
	const dotGap = Math.max(2, Math.round(dashGap))

	return {
		strokeDashoffset: `-${dashoffset}px`,
		opacity,
		strokeDasharray: `1 ${dotGap - 1}px`,
		strokeWidth: `${strokeWidth}px`,
		stroke: `rgb(${r}, ${g}, ${b})`,
		strokeLinecap: 'round',
	}
}
