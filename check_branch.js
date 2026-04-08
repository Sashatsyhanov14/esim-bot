const { execSync } = require('child_process');
const path = require('path');

const infobotPath = 'c:\\Users\\ТЕХНОРАЙ\\Desktop\\infobot';

try {
    const branch = execSync('git branch --show-current', { cwd: infobotPath }).toString().trim();
    console.log("Infobot Branch:", branch);
} catch (e) {
    console.error("Error checking branch:", e.message);
}
