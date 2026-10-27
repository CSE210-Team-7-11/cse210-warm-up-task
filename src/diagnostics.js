export const MAX_DIAGNOSTICS = 10

export const createDiagnostics = () => ({ items: [], count: 0 })

export function addDiagnostic(diagnostics, create) {
	diagnostics.count++
	if (diagnostics.items.length < MAX_DIAGNOSTICS) {
		diagnostics.items.push(create())
	}
}
