// Centralized case taxonomy shared across modals

export const CASE_TYPES: Record<string, string[]> = {
	Familiar: [
		'Divorcios',
		'Guardia y Custodia',
		'Acto Prejudicial',
		'Adopcion',
		'Pension Alimenticia',
		'Rectificacion de Actas',
		'Reclamacion de Paternidad',
	],
	Civil: [
		'Prescripcion Positiva',
		'Reinvindicatorio',
		'Intestado',
	],
	Psicologia: [
		'Individual',
		'Pareja',
	],
	Recursos: [
		'Tutoria Escolar',
		'Asistencia Social',
	],
};

export function findDepartmentByCaseType(caseType: string): string | null {
	for (const [dept, types] of Object.entries(CASE_TYPES)) {
		if (types.includes(caseType)) return dept;
	}
	return null;
}


