module.exports = {
    apps: [
        {
            name: 'bot1',
            script: 'npm',
            args: 'start',
            cwd: './bot',
            env: {
                NODE_ENV: 'production',
                PORT: 3001, // Each bot needs its own port
            },
            // If you want more bots on one VPS, just copy this block with a new name and port
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
