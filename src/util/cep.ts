/** True when running inside Adobe CEP (After Effects, Premiere, etc.). */
export function isCepRuntime(): boolean {
	if (typeof window === 'undefined') return false

	const w = window as Window & {
		cep?: unknown
		__adobe_cep__?: unknown
	}

	return 'cep' in w || '__adobe_cep__' in w
}
