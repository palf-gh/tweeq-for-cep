import {useFocus, useMagicKeys, whenever} from '@vueuse/core'
import {type ShallowRef} from 'vue'

const {Meta_C, Meta_V} = useMagicKeys()

export function useCopyPaste({
	target,
	onCopy,
	onPaste,
}: {
	target: Readonly<ShallowRef<HTMLElement | null>>
	onCopy?: () => void
	onPaste?: () => void | Promise<void>
}) {
	const {focused} = useFocus(target)

	if (onCopy) {
		whenever(Meta_C, () => {
			if (!focused.value) return
			try {
				onCopy()
			} catch {
				// Clipboard is unavailable in AE CEP.
			}
		})
	}

	if (onPaste) {
		whenever(Meta_V, () => {
			if (!focused.value) return
			void Promise.resolve(onPaste()).catch(() => {})
		})
	}
}
