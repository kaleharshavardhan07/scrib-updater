const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

function compileToPdf(latexContent) {
    // Create a temp directory for compilation
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "resume-"));
    const texFile = path.join(tmpDir, "resume.tex");
    const pdfFile = path.join(tmpDir, "resume.pdf");

    // Write the LaTeX content
    fs.writeFileSync(texFile, latexContent, "utf-8");

    try {
        // Run pdflatex twice (for references/TOC if any)
        const cmd = `pdflatex -interaction=nonstopmode -output-directory="${tmpDir}" "${texFile}"`;
        execSync(cmd, { timeout: 30000, stdio: "pipe" });
        // Second pass for references
        execSync(cmd, { timeout: 30000, stdio: "pipe" });

        if (!fs.existsSync(pdfFile)) {
            // Read the log for debugging
            const logFile = path.join(tmpDir, "resume.log");
            const log = fs.existsSync(logFile)
                ? fs.readFileSync(logFile, "utf-8").slice(-2000)
                : "No log file found";
            throw new Error(`PDF not generated. LaTeX log:\n${log}`);
        }

        return { pdfPath: pdfFile, tmpDir };
    } catch (err) {
        // Try to get helpful error info from the log
        const logFile = path.join(tmpDir, "resume.log");
        if (fs.existsSync(logFile)) {
            const log = fs.readFileSync(logFile, "utf-8");
            const errorLines = log
                .split("\n")
                .filter((l) => l.startsWith("!") || l.includes("Error"))
                .slice(0, 10)
                .join("\n");
            if (errorLines) {
                err.message += `\n\nLaTeX Errors:\n${errorLines}`;
            }
        }
        throw err;
    }
}

function cleanup(tmpDir) {
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }
}

module.exports = { compileToPdf, cleanup };
