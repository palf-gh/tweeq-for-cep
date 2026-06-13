<script lang="ts" setup>
import {Rect} from '@baku89/pave'
import {scalar} from 'linearly'
import {computed, useTemplateRef, withDefaults} from 'vue'

import {ColorCanvas, type SliderUniforms} from '../ColorCanvas'
import {useDrag} from '../use/useDrag'
import {toPercent} from '../util'
import {type ColorChannel, colorChannelToIndex, type HSVA} from './types'
import {
	getHSVAChannel,
	hsva2hex,
	setHSVAChannel,
	tweakHSVAChannel,
} from './utils'

interface Props {
	modelValue: HSVA
	axis: ColorChannel
	vertical?: boolean
}

const props = withDefaults(defineProps<Props>(), {vertical: false})

const emit = defineEmits<{
	'update:modelValue': [HSVA]
}>()

const $root = useTemplateRef('$root')

let local: HSVA

const {
	dragging: sliderTweaking,
	left,
	right,
	top,
	bottom,
	xy,
} = useDrag($root, {
	dragDelaySeconds: 0,
	onDragStart({xy: [x, y], left, right, top, bottom}, event) {
		local = props.modelValue

		const isAbsolute = event.target === $root.value

		if (isAbsolute) {
			const value = props.vertical
				? scalar.invlerp(bottom, top, y)
				: scalar.invlerp(left, right, x)

			local = setHSVAChannel(local, props.axis, value)
			emit('update:modelValue', local)
		}
	},
	onDrag({xy: [x, y], initial: [ix, iy], width, height}) {
		let newLocal = {...local}

		const delta = props.vertical ? (iy - y) / height : (x - ix) / width

		newLocal = tweakHSVAChannel(newLocal, props.axis, delta)

		emit('update:modelValue', newLocal)
	},
})

const tweakingInside = computed(() => {
	const bound: Rect = [
		[left.value, top.value],
		[right.value, bottom.value],
	]

	return sliderTweaking.value && Rect.containsPoint(bound, xy.value)
})

const uniforms = computed<SliderUniforms>(() => {
	const {a, h, s, v} = props.modelValue
	return {
		hsva: [h, s, v, a],
		axis: colorChannelToIndex(props.axis),
		offset: 0,
		vertical: props.vertical,
	}
})

const circleStyle = computed(() => {
	const t = getHSVAChannel(props.modelValue, props.axis)

	if (props.vertical) {
		return {
			bottom: toPercent(t),
			left: '50%',
			background: hsva2hex({...props.modelValue, a: 1}),
		}
	}

	return {
		left: toPercent(t),
		background: hsva2hex({...props.modelValue, a: 1}),
	}
})
</script>

<template>
	<div
		ref="$root"
		class="TqInputColorChannelSlider"
		:class="{vertical}"
		:style="{cursor: tweakingInside ? 'none' : undefined}"
	>
		<ColorCanvas class="canvas" type="slider" :uniforms="uniforms" />
		<button
			class="circle"
			:class="{tweaking: sliderTweaking}"
			:style="circleStyle"
		/>
	</div>
</template>

<style lang="stylus" scoped>
@import './common.styl'

.TqInputColorChannelSlider
	position relative
	width 100%
	height calc(0.7 * var(--tq-input-height))

	&.vertical
		width calc(0.7 * var(--tq-input-height))
		height 100%

.canvas
	position absolute
	width 100%
	height 100%
	border-radius var(--tq-radius-input)
	background-checkerboard(transparent)

.circle
	circle()
	z-index 1
</style>
