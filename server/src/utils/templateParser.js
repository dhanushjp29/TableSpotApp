import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '../templates');

/**
 * Reads an HTML template and injects dynamic variables.
 * @param {string} templateName - Name of the template file (without .html)
 * @param {Object} variables - Dictionary of variables to replace (e.g. { OTP: "123456" })
 * @returns {string} - The compiled HTML string
 */
export const compileTemplate = (templateName, variables = {}) => {
    try {
        const templatePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
        let html = fs.readFileSync(templatePath, 'utf8');

        html = html.replace(/{{>\s*([\w-]+)\s*}}/g, (_, partialName) => {
            const partialPath = path.join(TEMPLATES_DIR, `${partialName}.html`);
            return fs.readFileSync(partialPath, 'utf8');
        });

        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, String(value ?? ''));
        }

        return html;
    } catch (error) {
        console.error(`Error loading template ${templateName}:`, error);
        return ""; // Fallback gracefully
    }
};
