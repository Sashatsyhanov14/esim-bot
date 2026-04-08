const { execSync } = require('child_process');
const path = require('path');

const infobotPath = 'c:\\Users\\ТЕХНОРАЙ\\Desktop\\infobot';

try {
    const log = execSync('git log -n 1 --pretty=format:"%h %s"', { cwd: infobotPath }).toString().trim();
    console.log("Infobot Log:", log);
} catch (e) {
    console.error("Error checking log:", e.message);
}
