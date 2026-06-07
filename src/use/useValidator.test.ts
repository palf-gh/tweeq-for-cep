import {ref} from 'vue'
import {describe, expect, it} from 'vitest'

import {identity} from '../validator'
import {useValidator} from './useValidator'

describe('useValidator', () => {
	it('validates with identity when validator is undefined', () => {
		const local = ref('hello')
		const {validateResult} = useValidator(local, undefined)

		expect(validateResult.value).toEqual({value: 'hello', log: []})
	})

	it('falls back to identity when validator is not a function', () => {
		const local = ref(42)
		const {validateResult} = useValidator(local, {} as never)

		expect(validateResult.value).toEqual({value: 42, log: []})
	})

	it('uses the provided validator function', () => {
		const local = ref(2)
		const {validateResult} = useValidator(local, identity)

		expect(validateResult.value).toEqual({value: 2, log: []})
	})
})
