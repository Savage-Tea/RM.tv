const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
    });

    const apiCalls = [];
    const page = await context.newPage();

    // Intercept REQUESTS (fired immediately, doesn't wait for response)
    page.on('request', (request) => {
        const url = request.url();
        const ct = request.headers()['content-type'] || '';
        // Track requests that look like API calls
        if (ct.includes('json') || url.includes('/api/') || url.includes('/live/data') || url.includes('/v2/') || url.includes('leancloud') || url.includes('route') || url.includes('graphql') || url.includes('query')) {
            apiCalls.push({
                url,
                method: request.method(),
                status: 'pending',
                contentType: ct,
                body: '(request intercepted)',
            });
        }
    });

    // Intercept RESPONSES for the full picture
    page.on('response', async (response) => {
        const url = response.url();
        const status = response.status();
        const ct = response.headers()['content-type'] || '';

        // Track JSON API responses
        if (ct.includes('json') || ct.includes('javascript') || url.includes('/api/') || url.includes('/live/') || url.includes('/v2/') || url.includes('leancloud') || url.includes('route') || url.includes('graphql')) {
            let body = '';
            try {
                body = await response.text();
                if (body.length > 5000) body = body.substring(0, 5000) + '...[truncated]';
            } catch {}
            apiCalls.push({
                url,
                method: response.request().method(),
                status,
                contentType: ct,
                body,
            });
        }
    });

    // Track console messages for extra clues
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('http') || text.includes('api') || text.includes('error')) {
            console.log(`[console:${msg.type()}] ${text.substring(0, 200)}`);
        }
    });

    console.log('[+] Loading page...');
    await page.goto('https://www.robomaster.com/live?djifrom=banner', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
    });

    // Poll for XHR calls over time
    for (let i = 0; i < 6; i++) {
        await page.waitForTimeout(2000);
        const count = apiCalls.length;
        console.log(`[+] Waited ${(i+1)*2}s... API calls captured: ${count}`);
    }

    // Deduplicate by URL+method
    const seen = new Set();
    const unique = [];
    for (const call of apiCalls) {
        const key = `${call.method}:${call.url}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(call);
        }
    }

    console.log(`\n[+] Captured ${unique.length} unique API calls:\n`);

    for (const call of unique) {
        console.log('='.repeat(80));
        console.log(`METHOD: ${call.method}`);
        console.log(`URL:    ${call.url}`);
        console.log(`STATUS: ${call.status}`);
        console.log(`TYPE:   ${call.contentType}`);
        console.log('-'.repeat(80));
        try {
            const parsed = JSON.parse(call.body);
            console.log(JSON.stringify(parsed, null, 2));
        } catch {
            console.log(call.body || '(empty body)');
        }
        console.log('');
    }

    const title = await page.title();
    console.log(`[+] Page title: ${title}`);

    await browser.close();
})();
