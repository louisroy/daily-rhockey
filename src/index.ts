export interface Env {
    DB: D1Database;
}

export default {
    async scheduled(
        event: ScheduledEvent,
        env: Env,
        ctx: ExecutionContext
    ) {
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

        const navStatement = env.DB.prepare('SELECT * FROM documents ORDER BY created_at DESC LIMIT 7');
        if (!currentTimestamp) {
            currentTimestamp = await navStatement.first('created_at');
        }
        const navResults = await navStatement.all();
        const nav = navResults.results?.map((result: any) => {
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

        const mainStatement = env.DB.prepare('SELECT * FROM documents WHERE created_at = ?').bind(currentTimestamp);
        const xml: string = await mainStatement.first('body');
        // FIXME: use an actual XML parser instead of this garbage
        const links = xml?.match(/(?<=href=")(.*?)(?=")/igm)?.slice(2);
        const titles = xml?.match(/(?<=<title>)(.*?)(?=<\/title>)/igm)?.slice(1);
        const main = links?.map((link, i) => {
            return `
				<li>
					<a target="_blank" href="${link}">${titles![i]}</a>
				</li>
			`;
        });
        const html = `<!DOCTYPE html>
			<head>
				<title>Daily /r/hockey</title>
				<meta name="viewport" content="width=device-width,initial-scale=1">
				<style>
					body {
						max-width: 75ch;
						margin:0 auto;
						padding:0 10px;
					}
					
					nav {
					    font-size:13px;
					}
					
					ol {
					    padding-left:20px;
					}
					
					li  {
					    padding-bottom:15px;
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
                    <ol>
                        ${main?.join("")}
                    </ol>
				</main>
			</body>
		`;

        return new Response(html, {
            headers: {
                'content-type': 'text/html;charset=UTF-8',
            },
        });
    },
};
