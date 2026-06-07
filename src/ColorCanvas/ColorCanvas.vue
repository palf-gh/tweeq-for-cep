<script lang="ts" setup>
import {computed, useTemplateRef, watch} from 'vue'

import {useColorCanvasDraw} from './colorCanvasDraw'
import {
	buildRenderCacheKey,
	createPadDraw,
	createSliderDraw,
	createWheelDraw,
	type PadUniforms,
	type SliderUniforms,
	type WheelUniforms,
} from './colorRenderers'

export type ColorCanvasType = 'pad' | 'slider' | 'wheel'

interface Props {
	type: ColorCanvasType
	uniforms?: PadUniforms | SliderUniforms | WheelUniforms
}

const props = defineProps<Props>()

const $canvas = useTemplateRef('$canvas')
const scheduleDraw = useColorCanvasDraw($canvas)

const renderCacheKey = computed(() =>
	buildRenderCacheKey(props.type, props.uniforms)
)

watch(
	renderCacheKey,
	() => {
		if (props.type === 'pad' && props.uniforms) {
			scheduleDraw(createPadDraw(props.uniforms as PadUniforms))
			return
		}

		if (props.type === 'slider' && props.uniforms) {
			scheduleDraw(createSliderDraw(props.uniforms as SliderUniforms))
			return
		}

		if (props.type === 'wheel') {
			scheduleDraw(createWheelDraw())
		}
	},
	{immediate: true}
)
</script>

<template>
	<canvas ref="$canvas" class="ColorCanvas" />
</template>

<style lang="stylus" scoped>

.ColorCanvas
	pointer-events none
	display block
	width 100%
	height 100%
</style>
