export interface Env {
	DB: D1Database;
}

export default {
	async scheduled(
		event: ScheduledEvent,
		env: Env,
		ctx: ExecutionContext
	) {
		// Write code for updating your API
		switch (event.cron) {
			case '0 9 * * *':
				const created_at = Math.floor(new Date().getTime() / 1000)
				const response = await fetch("https://old.reddit.com/r/hockey/top/.rss?sort=top&t=day");
				const body = await response.text();
				await env.DB.prepare(
					"INSERT INTO documents (created_at, body) VALUES (?, ?)"
				).bind(created_at, body).all()
				break;
		}
	},

	fetch: async function (
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const {searchParams} = new URL(request.url)
		let currentTimestamp = searchParams.get('created_at')

		let stmt = env.DB.prepare('SELECT * FROM documents ORDER BY created_at DESC LIMIT 7');
		if (!currentTimestamp) {
			currentTimestamp = await stmt.first('created_at');
		}
		let all = await stmt.all();
		let nav = all.results?.map((result: any) => {
			let d = new Date(result.created_at * 1000);
			let day = d.toLocaleDateString("en-CA", {weekday: 'long'});
			if (result.created_at == currentTimestamp) {
				return `
					${day}
				`;
			} else {
				return `
					<a href="?created_at=${result.created_at}">${day}</a>
				`;
			}
		});

		stmt = env.DB.prepare('SELECT * FROM documents WHERE created_at = ?').bind(currentTimestamp);
		let xml: string = await stmt.first('body') ;
		let links = xml?.match(/(?<=href=")(.*?)(?=")/igm)?.slice(2);
		let titles = xml?.match(/(?<=<title>)(.*?)(?=<\/title>)/igm)?.slice(1);
		let body = links?.map((link, i) => {
			return `
				<p>
					<a target="_blank" href="${link}">${titles![i]}</a>
				</p>
			`;
		});
		return new Response(`<!DOCTYPE html>
			<head>
				<title>Daily /r/hockey</title>
				<style>
					p {
						max-width: 75ch;
					}
				</style>
			</head>
			<body>
				<h1>Daily /r/hockey</h1>
				<nav>
					${nav?.join("")}
				</nav>
				<hr />
				<main>
					${body?.join("")}
				</main>
			</body>
		`, {
			headers: {
				'content-type': 'text/html;charset=UTF-8',
			},
		});
	},
};
