import {
	type MaybeRef,
	unrefElement,
	useElementBounding,
	useEventListener,
	usePointerLock,
} from '@vueuse/core'
import {vec2} from 'linearly'
import {
	Component,
	computed,
	onBeforeUnmount,
	reactive,
	type Ref,
	toRefs,
	unref,
	watchEffect,
} from 'vue'

import {isCepRuntime} from '../util/cep'

interface DragState {
	xy: vec2
	previous: vec2
	initial: vec2
	delta: vec2
	origin: vec2
	top: number
	right: number
	bottom: number
	left: number
	width: number
	height: number
	dragging: boolean
	pointerLocked: boolean
}

type PointerType = 'mouse' | 'pen' | 'touch'

interface UseDragOptions {
	/**
	 * Whether dragging is disabled
	 * @default false
	 */
	disabled?: MaybeRef<boolean>

	/**
	 * Whether to lock the pointer when dragging
	 * @default false
	 */
	lockPointer?: MaybeRef<boolean>

	/**
	 * CEP/CEF-friendly pointer tracking (window-level listeners, no pointer lock).
	 * @default isCepRuntime()
	 */
	cep?: boolean

	/**
	 * Which pointer types can start dragging
	 * @default ['mouse', 'pen', 'touch']
	 */
	pointerType?: PointerType[]

	/**
	 * The continuous press time until it is regarded as dragging
	 * Set to 0 to start dragging immediately
	 * @default 0.5
	 */
	dragDelaySeconds?: number

	onClick?: (state: DragState, event: PointerEvent) => void
	onDrag?: (state: DragState, event: PointerEvent) => void
	onDragStart?: (state: DragState, event: PointerEvent) => void
	onDragEnd?: (state: DragState, event: PointerEvent) => void
}

export function useDrag(
	target: Ref<HTMLElement | SVGElement | Component | null>,
	{
		disabled,
		lockPointer = false,
		cep = isCepRuntime(),
		pointerType = ['mouse', 'pen', 'touch'],
		dragDelaySeconds = 0.5,
		onClick,
		onDrag,
		onDragStart,
		onDragEnd,
	}: UseDragOptions = {}
) {
	const state = reactive<DragState>({
		// All coordinates are relative to the viewport
		xy: vec2.zero,
		previous: vec2.zero,
		initial: vec2.zero,
		delta: vec2.zero,
		origin: vec2.zero,
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		width: 0,
		height: 0,
		dragging: false,
		pointerLocked: false,
	})

	let dragDelayTimer: ReturnType<typeof setTimeout> | undefined
	let pointerdown = false

	const cepCapture = {capture: true} as const
	let cepMoveCleanup: (() => void) | null = null

	const targetEl = computed<HTMLElement | SVGElement | null>(
		() => unrefElement(target.value) ?? null
	)

	const bound = useElementBounding(targetEl)

	const {lock, unlock} = usePointerLock(targetEl as any)

	watchEffect(
		() => {
			state.top = unref(bound.top)
			state.left = unref(bound.left)
			state.bottom = unref(bound.bottom)
			state.right = unref(bound.right)
			state.width = unref(bound.width)
			state.height = unref(bound.height)
			state.width = unref(bound.width)
			state.height = unref(bound.height)
		},
		{flush: 'sync'}
	)

	watchEffect(() => {
		state.origin = vec2.lerp(
			[state.left, state.top],
			[state.right, state.bottom],
			0.5
		)
	})

	if (cep) {
		useEventListener(targetEl, 'pointerdown', onPointerDown, cepCapture)
	} else {
		useEventListener(targetEl, 'pointerdown', onPointerDown)
		useEventListener(targetEl, 'pointermove', onPointerMove)
		useEventListener(targetEl, 'pointerup', onPointerUp)
		useEventListener(targetEl, 'pointercancel', onPointerUp)
		useEventListener(targetEl, 'pointerleave', onPointerUp)
	}

	onBeforeUnmount(() => {
		if (cep) {
			cepAbortDrag()
		}
		clearTimeout(dragDelayTimer)
		if (state.pointerLocked) {
			unlock()
		}
		state.pointerLocked = false
		pointerdown = false
		state.dragging = false
	})

	function cepCoercePointerEvent(event: Event): PointerEvent {
		if (typeof PointerEvent !== 'undefined' && event instanceof PointerEvent) {
			return event
		}
		const mouse = event as MouseEvent
		if (typeof PointerEvent === 'undefined') {
			return mouse as unknown as PointerEvent
		}
		return new PointerEvent(mouse.type.replace('mouse', 'pointer'), {
			bubbles: mouse.bubbles,
			cancelable: mouse.cancelable,
			clientX: mouse.clientX,
			clientY: mouse.clientY,
			screenX: mouse.screenX,
			screenY: mouse.screenY,
			button: mouse.button,
			buttons: mouse.buttons,
			ctrlKey: mouse.ctrlKey,
			shiftKey: mouse.shiftKey,
			altKey: mouse.altKey,
			metaKey: mouse.metaKey,
			pointerId: 1,
			pointerType: 'mouse',
			isPrimary: true,
		})
	}

	function cepDetachMoveListeners() {
		cepMoveCleanup?.()
	}

	function cepAttachMoveListeners() {
		cepDetachMoveListeners()
		const onMove = (event: Event) => {
			if (event.type === 'mousemove' && (event as MouseEvent).buttons === 0) {
				return
			}
			onPointerMove(cepCoercePointerEvent(event))
		}
		const onUp = (event: Event) => {
			onPointerUp(cepCoercePointerEvent(event))
		}
		const targets: Array<Window | Document> = []
		if (typeof window !== 'undefined') targets.push(window)
		if (typeof document !== 'undefined') targets.push(document)
		for (const target of targets) {
			target.addEventListener('pointermove', onMove, cepCapture)
			target.addEventListener('mousemove', onMove, cepCapture)
			target.addEventListener('pointerup', onUp, cepCapture)
			target.addEventListener('mouseup', onUp, cepCapture)
			target.addEventListener('pointercancel', onUp, cepCapture)
		}
		cepMoveCleanup = () => {
			for (const target of targets) {
				target.removeEventListener('pointermove', onMove, cepCapture)
				target.removeEventListener('mousemove', onMove, cepCapture)
				target.removeEventListener('pointerup', onUp, cepCapture)
				target.removeEventListener('mouseup', onUp, cepCapture)
				target.removeEventListener('pointercancel', onUp, cepCapture)
			}
			cepMoveCleanup = null
		}
	}

	function cepAbortDrag() {
		if (!pointerdown && !state.dragging) return
		cepDetachMoveListeners()
		if (state.dragging) {
			onDragEnd?.(state, new PointerEvent('pointercancel'))
		}
		clearTimeout(dragDelayTimer)
		pointerdown = false
		state.dragging = false
		state.pointerLocked = false
	}

	function fireDragStart(event: PointerEvent) {
		const shouldLock =
			!cep &&
			unref(lockPointer) &&
			target.value &&
			targetEl.value &&
			'requestPointerLock' in targetEl.value

		if (shouldLock) {
			lock(event)
			state.pointerLocked = true
		}

		state.dragging = true
		state.initial = state.previous
		onDragStart?.(state, event)
	}

	function onPointerDown(event: PointerEvent) {
		// Ignore when disabled
		if (unref(disabled)) return
		// Ignore non-left click
		if (event.button !== 0 || (!cep && !event.isPrimary)) return
		// Ignore non-pointer type
		if (
			event.pointerType &&
			!pointerType.includes(event.pointerType as PointerType)
		) {
			return
		}

		pointerdown = true

		// Initialize pointer position
		state.xy = state.previous = state.initial = [event.clientX, event.clientY]
		bound.update()

		if (dragDelaySeconds === 0) {
			// Start drag immediately
			fireDragStart(event)
		} else {
			dragDelayTimer = setTimeout(
				() => fireDragStart(event),
				dragDelaySeconds * 1000
			)
		}

		if (cep) {
			cepAttachMoveListeners()
		}

		try {
			;(event.target as Element).setPointerCapture(event.pointerId)
		} catch {
			// setPointerCapture can throw in CEF
		}
	}

	function onPointerMove(event: PointerEvent) {
		if (!pointerdown) return

		if (
			!cep &&
			event.movementX !== undefined &&
			event.movementY !== undefined
		) {
			// movement properties ignores the zoom level of browser,
			// so we need to scale it by the zoom
			const zoomLevel = window.outerWidth / window.innerWidth
			const movement = vec2.scale(
				[event.movementX, event.movementY],
				1 / zoomLevel
			)

			state.xy = vec2.add(state.xy, movement)
		} else {
			state.xy = [event.clientX, event.clientY]
		}

		state.delta = vec2.sub(state.xy, state.previous)
		bound.update()

		if (vec2.squaredLength(state.delta) === 0) return

		if (!state.dragging) {
			// Determine whether dragging has started
			const d = vec2.dist(state.initial, state.xy)
			const minDragDistance = (event.pointerType || 'mouse') === 'mouse' ? 1 : 5
			if (d >= minDragDistance) {
				clearTimeout(dragDelayTimer)
				fireDragStart(event)
			}
		}

		if (state.dragging) {
			onDrag?.(state, event)
		}

		state.previous = state.xy
	}

	function onPointerUp(event: PointerEvent) {
		if (cep) {
			cepDetachMoveListeners()
		}

		if (state.pointerLocked) {
			unlock()
		}
		state.pointerLocked = false

		if (pointerdown) {
			if (state.dragging) {
				onDragEnd?.(state, event)
			} else {
				onClick?.(state, event)
			}
		}

		// Reset
		clearTimeout(dragDelayTimer)
		pointerdown = false
		state.dragging = false
		state.xy = state.initial = state.delta = vec2.zero

		try {
			;(event.target as Element).releasePointerCapture(event.pointerId)
		} catch {
			// releasePointerCapture can throw in CEF
		}
	}

	return toRefs(state)
}
