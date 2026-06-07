<script setup lang="ts">
import {useEventListener} from '@vueuse/core'
import {useTemplateRef, watchEffect} from 'vue'

import {setPopoverOpen, supportsPopoverApi} from '../util/popover'

defineSlots<{
	default: void
}>()

const props = withDefaults(
	defineProps<{
		open: boolean
	}>(),
	{
		open: false,
	}
)

const emit = defineEmits<{
	close: []
	'update:open': [boolean]
}>()

const $root = useTemplateRef('$root')
const popoverApiSupported = supportsPopoverApi()

if (popoverApiSupported) {
	useEventListener($root, 'toggle', (e: ToggleEvent) => {
		if (e.newState !== 'open') {
			close()
		}
	})
}

useEventListener('keydown', e => {
	if (e.key === 'Escape' && props.open) {
		close()
	}
})

function close() {
	emit('update:open', false)
	emit('close')
}

watchEffect(() => {
	setPopoverOpen($root.value, props.open)
})
</script>

<template>
	<div
		ref="$root"
		class="TqPaneModal"
		:popover="popoverApiSupported ? 'auto' : undefined"
	>
		<slot />
	</div>
</template>

<!--
	The popover is promoted to the top layer and rendered outside .TqViewport,
	so it misses Tweeq's viewport reset (font-family, etc.) and falls back to
	the UA serif font. Apply the reset here, unscoped so it also reaches slotted
	content — same approach as MultiSelectPopup.
-->
<style lang="stylus">
@import '../common.styl'

reset-viewport('.TqPaneModal')
</style>

<style scoped lang="stylus">
@import '../common.styl'

.TqPaneModal
	popup-style()
	inset 0
	margin auto
	padding var(--tq-pane-padding)
	transition opacity var(-tq-transition-duration), transform var(-tq-transition-duration), overlay var(-tq-transition-duration) allow-discrete, display var(-tq-transition-duration) allow-discrete
	opacity 0
	transform translateY(calc(var(--tq-rem) / -2))

	&[popover]::backdrop
		backdrop-filter blur(0px)
		transition backdrop-filter var(-tq-transition-duration)

	&:popover-open
		opacity 1
		transform translateY(0)

		&::backdrop
			backdrop-filter blur(4px)

		@starting-style
			&
				transform translateY(calc(var(--tq-rem) / -2))
				opacity 0

			&::backdrop
				backdrop-filter blur(0px)
</style>
