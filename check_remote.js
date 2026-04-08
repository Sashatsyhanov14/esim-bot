const { execSync } = require('child_process');
const path = require('path');

const infobotPath = 'c:\\Users\\ТЕХНОРАЙ\\Desktop\\infobot';

try {
    const remote = execSync('git remote -v', { cwd: infobotPath }).toString();
    console.log("Infobot Remote:", remote);
} catch (e) {
    console.error("Error checking remote:", e.message);
}
