const OpenAI = require('openai');
const axios = require('axios');
const dotenv = require('dotenv');
const { ANALYZER_PROMPT, WRITER_PROMPT, LOCALIZER_PROMPT } = require('./prompts');

const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: (process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '').trim(),
    timeout: 120000, 
    defaultHeaders: {
        'HTTP-Referer': 'https://esim-bot.com',
        'X-Title': 'eSIM Bot',
    }
});

module.exports = {
    async getChatResponse(tariffs, faqText, history, userMessage) {
        try {
            // === AGENT 1: THE ANALYZER ===
            const analyzerMessages = [
                { role: 'system', content: ANALYZER_PROMPT(tariffs) },
                ...history,
                { role: 'user', content: userMessage }
            ];

            const analyzerResponse = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: analyzerMessages,
                temperature: 0.1 // Низкая температура для строгой логики
            });

            const rawJsonStr = analyzerResponse.choices[0].message.content;
            console.log("Analyzer Output:", rawJsonStr);

            let analysis;
            try {
                // Очистка от возможных markdown тегов ```json ... ```
                const cleanJsonStr = rawJsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
                analysis = JSON.parse(cleanJsonStr);
            } catch (e) {
                console.error("JSON Parse Error:", e);
                analysis = { lang_code: "ru", intent: "consultation", writer_instruction: "Произошла системная ошибка при парсинге ответа. Пожалуйста, извинись перед клиентом и попроси повторить запрос." };
            }

            // === AGENT 2: THE WRITER ===
            const localizedTariffs = tariffs.map(t => {
                const l = analysis.lang_code || 'en';
                const country = (l !== 'en' && t[`country_${l}`]) ? t[`country_${l}`] : t.country;
                return { ...t, country, data_gb: t.data_gb, validity_period: t.validity_period };
            });

            const writerMessages = [
                { role: 'system', content: WRITER_PROMPT(localizedTariffs, faqText) },
                { role: 'user', content: `Инструкции Главного Агента (Аналитика):\n\nОтвечай строго на языке: ${analysis.lang_code}\nКраткая суть: ${analysis.intent}\n\nСАМА ИНСТРУКЦИЯ (что именно сказать клиенту, какие цены и гигабайты назвать):\n${analysis.writer_instruction}` }
            ];

            const writerResponse = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: writerMessages,
                temperature: 0.7,
            });

            const finalMessage = writerResponse.choices[0].message.content;

            // Скрыто прикрепляем теги для парсера в index.js
            let embeddedTags = `[LANG:${analysis.lang_code}]`;
            if (analysis.intent === 'sale' && analysis.tariff_id) {
                embeddedTags += `\n[SALE_REQUEST: ${analysis.tariff_id}]`;
            }

            return finalMessage + '\n' + embeddedTags;

        } catch (error) {
            console.error('[OpenAI Fatal Error]:', error.message);
            if (error.response) {
                console.error('[OpenAI Status]:', error.response.status);
                console.error('[OpenAI Data]:', error.response.data);
            }
            return 'Извини, я приуныл. Попробуй позже.';
        }
    },
    async getLocalizedText(langCode, russianText, retries = 2) {
        if (!langCode || langCode === 'ru') return russianText;

        // Try OpenRouter first (with 8 second timeout)
        const attempt = async () => {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Localizer timeout')), 8000)
            );
            const translate = openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: [
                    { role: 'system', content: LOCALIZER_PROMPT },
                    { role: 'user', content: `Язык: ${langCode}\nТекст:\n${russianText}` }
                ],
                temperature: 0.2,
            });
            const response = await Promise.race([translate, timeout]);
            return response.choices[0].message.content.trim();
        };

        for (let i = 0; i < retries; i++) {
            try {
                const result = await attempt();
                console.log(`[LOCALIZER] OpenRouter OK (attempt ${i + 1}) lang=${langCode}`);
                return result;
            } catch (e) {
                console.warn(`[LOCALIZER] OpenRouter attempt ${i + 1} failed: ${e.message}`);
                if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
            }
        }

        // Fallback: MyMemory free translation API (no key required)
        try {
            console.log(`[LOCALIZER] Falling back to MyMemory for lang=${langCode}`);
            // MyMemory supports max ~500 chars per request, split if needed
            const chunks = russianText.match(/[\s\S]{1,400}/g) || [russianText];
            const translated = [];

            for (const chunk of chunks) {
                const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=ru|${langCode}`;
                const res = await axios.get(url, { timeout: 5000 });
                const translatedChunk = res.data?.responseData?.translatedText || chunk;
                translated.push(translatedChunk);
            }

            const result = translated.join('');
            console.log(`[LOCALIZER] MyMemory OK for lang=${langCode}`);
            return result;
        } catch (e) {
            console.error(`[LOCALIZER] MyMemory also failed: ${e.message}. Returning Russian.`);
            return russianText;
        }
    }
};
