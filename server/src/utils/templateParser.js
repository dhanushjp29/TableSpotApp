import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATES_DIR = path.join(__dirname, '../templates');

export const escapeHtml = (input) => String(input ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

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

        // Interpolate escaped values by default. Triple braces are reserved
        // for trusted, server-generated HTML fragments such as a details
        // table or CTA block.
        html = html.replace(/{{{\s*([\w-]+)\s*}}}|{{\s*([\w-]+)\s*}}/g, (match, rawKey, escapedKey) => {
            const key = rawKey || escapedKey;
            const value = variables[key];
            return rawKey ? String(value ?? '') : escapeHtml(value);
        });

        return html;
    } catch (error) {
        console.error(`Error loading template ${templateName}:`, error);
        return ""; // Fallback gracefully
    }
};
