import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';

export const load: PageLoad = ({ params }) => {
	if (params.section === 'milestones') throw redirect(307, '/work/projects');
};
