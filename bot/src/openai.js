const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const openai = new OpenAI({
    baseURL: 'https://polza.ai/api/v1',
    apiKey: process.env.OPENAI_API_KEY,
});


module.exports = {
    async getChatResponse(systemPrompt, history, userMessage) {
        try {
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: userMessage }
            ];

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                temperature: 0.7,
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI Error:', error);
            return 'Извини, я приуныл. Попробуй позже.';
        }
    }
};
