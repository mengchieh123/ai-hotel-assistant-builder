const fs = require('fs');

// 读取原文件
const content = fs.readFileSync('server.js', 'utf8');

// 查找 fetchWithRetry 函数并替换
const fixedContent = content.replace(
  /async function fetchWithRetry\(url, options, retries = 3\) \{[\s\S]*?^\}/m,
  `async function fetchWithRetry(url, options, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(\`[Gemini API] Sending request to: \${url}\`);
            const response = await nodeFetch(url, options);

            if (response.ok) {
                return response;
            }

            if (response.status === 429 || response.status >= 500) {
                console.warn(\`[Gemini API] Request failed with status \${response.status}. Retrying in \${2 ** i}s...\`);
            } else {
                const errorText = await response.text();
                throw new Error(\`API returned status \${response.status}: \${errorText}\`);
            }
        } catch (error) {
            if (i === retries - 1) {
                throw new Error(\`Error communicating with Gemini API: \${error.message}\`);
            }
            console.error(\`[Gemini API] Request failed: \${error.message}. Retrying...\`);
        }
        await new Promise(resolve => setTimeout(resolve, (2 ** i) * 1000));
    }
    throw new Error(\`All \${retries} retry attempts failed\`);
}`
);

// 写入修复后的内容
fs.writeFileSync('server.js', fixedContent);
console.log('修复完成！');
