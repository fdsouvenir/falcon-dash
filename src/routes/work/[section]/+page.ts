import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';

export const load: PageLoad = ({ params, url }) => {
	if (params.section === 'milestones') throw redirect(307, '/work/projects');
	if (params.section === 'open-questions' || params.section === 'decisions') {
		throw redirect(307, `/work/needs-resolution${url.search}`);
	}
};
