import {
	computed,
	MaybeRef,
	readonly,
	Ref,
	ref,
	toValue,
	watchSyncEffect,
} from 'vue'

import {identity, type ValidateResult, type Validator} from '../validator'

function resolveValidator<T>(
	validator: MaybeRef<Validator<T> | undefined>
): Validator<T> {
	const fn = toValue(validator)
	return typeof fn === 'function' ? fn : identity
}

export function useValidator<T>(
	local: Readonly<Ref<T>>,
	validator: MaybeRef<Validator<T> | undefined>
) {
	const validateResult = computed<ValidateResult<T>>(() => {
		return resolveValidator(validator)(local.value)
	})
	const validLocal = ref<T>()

	watchSyncEffect(() => {
		if (validateResult.value.value === undefined) return

		validLocal.value = validateResult.value.value
	})

	return {
		validLocal: readonly(validLocal),
		validateResult,
	}
}
