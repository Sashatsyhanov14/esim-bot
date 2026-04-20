module.exports = {
    apps: [
        {
            name: 'bot1',
            script: 'npm',
            args: 'start',
            cwd: './bot1/bot',
            env: { NODE_ENV: 'production', PORT: 3001 }
        },
        {
            name: 'bot2',
            script: 'npm',
            args: 'start',
            cwd: './bot2/bot',
            env: { NODE_ENV: 'production', PORT: 3002 }
        },
        {
            name: 'bot3',
            script: 'npm',
            args: 'start',
            cwd: './bot3/bot',
            env: { NODE_ENV: 'production', PORT: 3003 }
        },
        {
            name: 'bot4',
            script: 'npm',
            args: 'start',
            cwd: './bot4/bot',
            env: { NODE_ENV: 'production', PORT: 3004 }
        }
    ],
};
