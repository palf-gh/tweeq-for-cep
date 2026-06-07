export function supportsPopoverApi(): boolean {
	return (
		typeof HTMLElement !== 'undefined' &&
		'popover' in HTMLElement.prototype &&
		typeof (HTMLElement.prototype as HTMLElement & {togglePopover?: unknown})
			.togglePopover === 'function'
	)
}

export function setPopoverOpen(
	element: HTMLElement | null | undefined,
	open: boolean
): void {
	if (!element) return

	if (supportsPopoverApi()) {
		element.togglePopover(open)
		return
	}

	element.style.display = open ? '' : 'none'
}

export function hidePopover(element: HTMLElement | null | undefined): void {
	setPopoverOpen(element, false)
}

export function togglePopover(element: HTMLElement | null | undefined): void {
	if (!element) return

	if (supportsPopoverApi()) {
		element.togglePopover()
		return
	}

	const isOpen = element.style.display !== 'none'
	setPopoverOpen(element, !isOpen)
}
