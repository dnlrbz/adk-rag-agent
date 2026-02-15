import 'dotenv/config';
import { rootAgent } from './agent';
import { InMemoryRunner } from '@google/adk';

async function main() {
    console.log('Starting runner with agent:', rootAgent.name);

    const userId = 'test_user';
    const appName = rootAgent.name;
    const runner = new InMemoryRunner({ agent: rootAgent, appName });

    const session = await runner.sessionService.createSession({
        appName,
        userId,
    });

    for await (const e of runner.runAsync({
        userId,
        sessionId: session.id,
        newMessage: { parts: [{ text: 'List all corpora.' }] },
    })) {
        // Replace the simple JSON log with a parser that handles JSON string or plain text
        const part = e.content?.parts?.[0];
        if (!part) continue;

        const raw = part.text ?? null;
        if (!raw) {
            console.log(`${e.author}: ${JSON.stringify(e.content, null, 2)}`);
            continue;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (_err) {
            parsed = raw;
        }

        console.log(`${e.author}:`);
        if (typeof parsed === 'string') {
            console.log(parsed);
        } else if (parsed && typeof parsed === 'object') {
            // If this looks like the list_corpora result, print nicely
            // @ts-ignore
            if ('status' in parsed && Array.isArray((parsed as any).corpora)) {
                // @ts-ignore
                console.log('Status:', (parsed as any).status);
                // @ts-ignore
                console.log('Message:', (parsed as any).message);
                // @ts-ignore
                console.log('Corpora:');
                // @ts-ignore
                for (const c of (parsed as any).corpora) {
                    // tolerate missing fields
                    const name = c.display_name || c.displayName || '<no-name>';
                    const resource = c.resource_name || c.resourceName || c.resource || '<no-resource>';
                    const created = c.create_time || c.create_time || c.createTime || '';
                    console.log(` - ${name} (${resource}) created: ${created}`);
                }
            } else {
                console.log(JSON.stringify(parsed, null, 2));
            }
        } else {
            console.log(String(parsed));
        }
    }
}

main().catch(console.error);
