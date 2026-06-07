<script lang="ts" setup>
import {useTemplateRef, watch} from 'vue'

import {
	createPadDraw,
	createSliderDraw,
	createWheelDraw,
	useColorCanvasDraw,
} from './colorCanvasDraw'
import type {PadUniforms, SliderUniforms, WheelUniforms} from './colorRenderers'

export type ColorCanvasType = 'pad' | 'slider' | 'wheel'

interface Props {
	type: ColorCanvasType
	uniforms?: PadUniforms | SliderUniforms | WheelUniforms
}

const props = defineProps<Props>()

const $img = useTemplateRef('$img')
const scheduleDraw = useColorCanvasDraw($img)

watch(
	() => [props.type, props.uniforms] as const,
	([type, uniforms]) => {
		if (type === 'pad' && uniforms) {
			scheduleDraw(createPadDraw(uniforms as PadUniforms))
		} else if (type === 'slider' && uniforms) {
			scheduleDraw(createSliderDraw(uniforms as SliderUniforms))
		} else if (type === 'wheel') {
			scheduleDraw(createWheelDraw())
		}
	},
	{immediate: true, deep: true, flush: 'post'}
)
</script>

<template>
	<img ref="$img" class="ColorCanvas" alt="" />
</template>

<style lang="stylus" scoped>

.ColorCanvas
	pointer-events none
	display block
	max-width 100%
	max-height 100%
	object-fit fill
</style>
