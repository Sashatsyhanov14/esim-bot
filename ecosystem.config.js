module.exports = {
    apps: [
        {
            name: 'bot1',
            script: 'npm',
            args: 'start',
            cwd: './bot1/bot', // Points to the specific bot project folder
            env: {
                NODE_ENV: 'production',
                PORT: 3001,
            },
        },
        /*
        {
          name: 'esim-bot-2',
          script: 'npm',
          args: 'start',
          cwd: '/path/to/another/bot',
          env: {
            NODE_ENV: 'production',
            PORT: 3002,
          },
        },
        */
    ],
};
