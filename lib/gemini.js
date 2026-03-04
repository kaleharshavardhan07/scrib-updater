const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function tailorResume(latexContent, companyName, jobDescription) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          summary: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "A bulleted list explaining exactly what was changed in the resume (e.g. keywords added, bullet points reworded, targeting the specified company)."
          },
          modifiedLatex: {
            type: SchemaType.STRING,
            description: "The complete, properly formatted modified LaTeX source code."
          }
        },
        required: ["summary", "modifiedLatex"]
      }
    }
  });

  const prompt = `You are an expert technical resume writer and ATS optimization specialist.

I will provide:
1. Target Company Name
2. A job description  
3. A LaTeX resume (for a new graduate / junior developer)

Your task is to tailor the resume for the specific job description and company.

CRITICAL RULES — FOLLOW EXACTLY:

1. NO STRUCTURAL CHANGES: Do NOT change any LaTeX commands, document class, 
   packages, or formatting. Only modify actual text content within the commands.

2. NO FABRICATION: Do NOT invent new experiences, projects, or education. 
   Do NOT change names of companies or projects.

3. PRESERVE TIMELINES: Do NOT change any dates or durations.

4. KEYWORD INJECTION: Naturally weave relevant keywords from the job description into:
   - Professional Summary (reword to mirror JD language)
   - Project bullet points (add context that highlights JD overlap)
   - Experience bullet points (emphasize relevant responsibilities)

5. SKILLS SECTION: Only add a skill if there is direct evidence of it already 
   in the resume (used in a project or mentioned in experience). 
   Do NOT add any skill with zero evidence in the resume.

6. DO NOT TOUCH: Contact info, institution names, degree names, GPA, 
   project names, company names, dates, or any LaTeX commands.

7. FULL DOCUMENT REQUIRED: You MUST return the ENTIRE, COMPLETE LaTeX file from \documentclass to \end{document}. 
   Do NOT return a partial snippet. Do NOT truncate the file. Every single line of the original LaTeX preamble and structure must be included. 
   Do NOT wrap the output in markdown code blocks (e.g. \`\`\`latex).

For the summary array, format each item as:
"[Section] — [what changed] — [why, tied to JD]"
Example: "Skills — Added 'REST APIs' — keyword appears 6 times in JD and was used in Project Alpha"

=== TARGET COMPANY ===
${companyName}

=== JOB DESCRIPTION ===
${jobDescription}

=== LATEX RESUME ===
${latexContent}`;


  const result = await model.generateContent(prompt);
  const response = await result.response;
  const jsonText = response.text();

  return JSON.parse(jsonText);
}

module.exports = { tailorResume };
