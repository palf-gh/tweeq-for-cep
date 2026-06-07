<script lang="ts" setup>
import {onClickOutside, useEventListener} from '@vueuse/core'
import {computed, toRef, useTemplateRef, watch} from 'vue'
import {flip, shift, useFloating, autoUpdate, offset} from '@floating-ui/vue'

import {nodeContains} from '../util'
import {setPopoverOpen, supportsPopoverApi} from '../util/popover'
import type {PopoverProps} from './types'

const props = withDefaults(defineProps<PopoverProps>(), {
	open: false,
	placement: 'bottom-start',
	lightDismiss: true,
	offset: 0,
})

const emit = defineEmits<{
	'update:open': [boolean]
	close: []
}>()

const $popover = useTemplateRef('$popover')
const popoverApiSupported = supportsPopoverApi()

useEventListener('keydown', e => {
	if (e.key === 'Escape' && props.open) {
		emit('close')
		emit('update:open', false)
	}
})

if (popoverApiSupported) {
	useEventListener($popover, 'toggle', e => {
		const {newState} = (e as Event & {newState?: string})
		if (newState === 'close') {
			emit('close')
		}
		if (newState === 'open' || newState === 'close') {
			emit('update:open', newState === 'open')
		}
	})
}

if (!popoverApiSupported && props.lightDismiss) {
	onClickOutside($popover, event => {
		if (!props.open) return

		const reference = props.reference
		if (reference && nodeContains(reference, event.target as Node)) {
			return
		}

		emit('close')
		emit('update:open', false)
	})
}

watch(
	() => [props.open, $popover.value] as const,
	([open, popover]) => {
		setPopoverOpen(popover, open)
	}
)

const {floatingStyles} = useFloating(toRef(props, 'reference'), $popover, {
	placement: typeof props.placement === 'string' ? props.placement : undefined,
	strategy: 'fixed',
	whileElementsMounted: autoUpdate,
	middleware: [flip(), shift(), offset(props.offset)],
})

const styles = computed(() => {
	if (typeof props.placement === 'string') {
		return floatingStyles.value
	}

	return {left: props.placement[0] + 'px', top: props.placement[1] + 'px'}
})

const popoverMode = computed(() => {
	if (!popoverApiSupported) return undefined
	return props.lightDismiss ? 'auto' : 'manual'
})
</script>

<template>
	<div
		v-if="open"
		ref="$popover"
		class="Popover"
		:style="styles"
		:popover="popoverMode"
	>
		<slot />
	</div>
</template>

<style lang="stylus" scoped>

.Popover
	background transparent
	overflow visible
</style>
