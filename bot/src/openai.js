const OpenAI = require('openai');
const dotenv = require('dotenv');
const { ANALYZER_PROMPT, WRITER_PROMPT, LOCALIZER_PROMPT } = require('./prompts');

dotenv.config();

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENAI_API_KEY,
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
            const writerMessages = [
                { role: 'system', content: WRITER_PROMPT(tariffs, faqText) },
                { role: 'user', content: `Инструкции Главного Агента (Аналитика):\n\nОтвечай строго на языке: ${analysis.lang_code}\nКраткая суть: ${analysis.intent}\n\nСАМА ИНСТРУКЦИЯ (что именно сказать клиенту, какие цены и гигабайты назвать):\n${analysis.writer_instruction}\n\n${analysis.tariff_id ? 'SALE_ID для активации системы: ' + analysis.tariff_id : ''}` }
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
            console.error('OpenAI Error:', error);
            return 'Извини, я приуныл. Попробуй позже.';
        }
    },
    async getLocalizedText(langCode, russianText) {
        // If Russian or unknown - return as-is to save API calls
        if (!langCode || langCode === 'ru') return russianText;
        try {
            const response = await openai.chat.completions.create({
                model: 'openai/gpt-4o-mini',
                messages: [
                    { role: 'system', content: LOCALIZER_PROMPT },
                    { role: 'user', content: `Язык: ${langCode}\nТекст:\n${russianText}` }
                ],
                temperature: 0.2,
            });
            return response.choices[0].message.content.trim();
        } catch (e) {
            console.error('Localizer error:', e.message);
            return russianText; // Fallback to Russian on error
        }
    }
};
