require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const { tailorResume } = require("./lib/gemini");
const { compileToPdf, cleanup } = require("./lib/pdfCompiler");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(express.json({ limit: "5mb" }));

// Ensure output directory exists
const outputDir = path.join(__dirname, "output");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Resume file path
const RESUME_PATH = path.join(__dirname, "resume.tex");

// ─── Routes ──────────────────────────────────────────

// Home page
app.get("/", (req, res) => {
    let resumeExists = fs.existsSync(RESUME_PATH);
    let resumeContent = "";
    if (resumeExists) {
        resumeContent = fs.readFileSync(RESUME_PATH, "utf-8");
    }
    res.render("index", {
        resumeExists,
        resumeContent,
        companyName: "",
        jobDescription: "",
        error: null,
        success: null,
        modifiedLatex: null,
        summary: null,
    });
});

// Step 1: Analyze and suggest changes
app.post("/analyze", async (req, res) => {
    const { companyName, jobDescription, resumeContent } = req.body;

    if (!companyName || !jobDescription || !companyName.trim() || !jobDescription.trim()) {
        return res.render("index", {
            resumeExists: true,
            resumeContent: resumeContent || "",
            companyName: companyName || "",
            jobDescription: jobDescription || "",
            error: "Please provide both Company Name and Job Description.",
            success: null,
            modifiedLatex: null,
            summary: null,
        });
    }

    let latexContent;
    if (resumeContent && resumeContent.trim()) {
        latexContent = resumeContent;
    } else if (fs.existsSync(RESUME_PATH)) {
        latexContent = fs.readFileSync(RESUME_PATH, "utf-8");
    } else {
        return res.render("index", {
            resumeExists: false,
            resumeContent: "",
            companyName,
            jobDescription,
            error: 'No resume.tex found. Please place your LaTeX resume file in the project root.',
            success: null,
            modifiedLatex: null,
            summary: null,
        });
    }

    try {
        console.log(`🤖 Calling Gemini to analyze for ${companyName}...`);
        const { summary, modifiedLatex } = await tailorResume(latexContent, companyName, jobDescription);
        console.log("✅ Gemini returned suggestions");

        res.render("index", {
            resumeExists: true,
            resumeContent: latexContent,
            companyName,
            jobDescription,
            error: null,
            success: null, // success is for download
            modifiedLatex,
            summary,
        });
    } catch (err) {
        console.error("❌ Gemini Error:", err);
        res.render("index", {
            resumeExists: fs.existsSync(RESUME_PATH),
            resumeContent: latexContent || "",
            companyName,
            jobDescription,
            error: `Error communicating with Gemini: ${err.message}`,
            success: null,
            modifiedLatex: null,
            summary: null,
        });
    }
});

// Step 2: Compile PDF
app.post("/compile", (req, res) => {
    const { modifiedLatex, companyName, jobDescription, resumeContent } = req.body;

    if (!modifiedLatex) {
        return res.render("index", {
            resumeExists: true,
            resumeContent: resumeContent || "",
            companyName: companyName || "",
            jobDescription: jobDescription || "",
            error: "No modified LaTeX provided to compile.",
            success: null,
            modifiedLatex: null,
            summary: null,
        });
    }

    let tmpDir = null;
    try {
        console.log("📄 Compiling PDF with pdflatex...");
        const { pdfPath, tmpDir: td } = compileToPdf(modifiedLatex);
        tmpDir = td;
        console.log("✅ PDF compiled successfully");

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const sanitizedCompany = (companyName || "company").replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const outputFilename = `resume_${sanitizedCompany}_${timestamp}.pdf`;
        const outputPath = path.join(outputDir, outputFilename);
        const texOutputPath = path.join(outputDir, `resume_${sanitizedCompany}_${timestamp}.tex`);

        fs.copyFileSync(pdfPath, outputPath);
        fs.writeFileSync(texOutputPath, modifiedLatex, "utf-8");
        cleanup(tmpDir);

        res.render("index", {
            resumeExists: true,
            resumeContent: resumeContent || "",
            companyName,
            jobDescription,
            error: null,
            success: {
                message: "PDF Generated Successfully!",
                downloadUrl: `/download/${outputFilename}`
            },
            modifiedLatex,
            summary: null, // Clear summary to show final success state
        });

    } catch (err) {
        console.error("❌ Compile Error:", err.message);
        if (tmpDir) cleanup(tmpDir);
        res.render("index", {
            resumeExists: fs.existsSync(RESUME_PATH),
            resumeContent: resumeContent || "",
            companyName,
            jobDescription,
            error: `Compilation Error: ${err.message}`,
            success: null,
            modifiedLatex,
            summary: null,
        });
    }
});

// Download PDF
app.get("/download/:filename", (req, res) => {
    const filePath = path.join(outputDir, req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }
    res.download(filePath);
});

// ─── Start ───────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n🚀 Resume Builder running at http://localhost:${PORT}`);
    console.log(`📂 Resume file: ${RESUME_PATH}`);
    console.log(
        `📄 Resume exists: ${fs.existsSync(RESUME_PATH) ? "✅ Yes" : "❌ No — place your resume.tex in the project root"}`
    );
    console.log();
});
