import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

/** Legacy URL from before the Automations rename (#344). */
export const load: PageServerLoad = ({ params, url }) => {
	redirect(308, `/work/automations/${params.id}${url.search}`);
};
