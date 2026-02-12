const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

app.listen(5000, () => {
    console.log("The server is running on port 5000");
});

app.get("/", (req, res) => {
    res.send("Server is working");
});

app.post('/run', (req, res) => {
    const { code, language } = req.body;

    if (!code || !language) {
        return res.json({
            success: false,
            output: "Missing code or language"
        });
    }

    // Generate unique ID for this execution
    const execId = randomUUID();
    let command = "";
    let filePath = "";

    try {
        if (language === "python") {
            filePath = path.join(tempDir, `temp_${execId}.py`);
            fs.writeFileSync(filePath, code);
            command = `python "${filePath}"`;
        }
        else if (language === "java") {
            filePath = path.join(tempDir, `Main_${execId}.java`);
            const classFile = path.join(tempDir, `Main_${execId}.class`);
            fs.writeFileSync(filePath, code);
            command = `javac "${filePath}" && java -cp "${tempDir}" Main_${execId}`;
        }
        else if (language === "c") {
            filePath = path.join(tempDir, `temp_${execId}.c`);
            const exePath = path.join(tempDir, `temp_${execId}`);
            fs.writeFileSync(filePath, code);
            command = process.platform === "win32"
                ? `gcc "${filePath}" -o "${exePath}.exe" && "${exePath}.exe"`
                : `gcc "${filePath}" -o "${exePath}" && "${exePath}"`;
        }
        else {
            return res.json({
                success: false,
                output: "Unknown language"
            });
        }

        // Execute with timeout
        exec(command, { timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            // Cleanup files
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                
                if (language === "java") {
                    const classFile = path.join(tempDir, `Main_${execId}.class`);
                    if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
                }
                
                if (language === "c") {
                    const exePath = path.join(tempDir, `temp_${execId}${process.platform === "win32" ? ".exe" : ""}`);
                    if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
                }
            } catch (cleanupError) {
                console.error("Cleanup error:", cleanupError);
            }

            if (error) {
                return res.json({
                    success: false,
                    output: error.killed ? "Execution timeout (5s limit)" : error.message
                });
            }
            
            if (stderr) {
                return res.json({
                    success: false,
                    output: stderr
                });
            }
            
            return res.json({
                success: true,
                output: stdout || "Program executed successfully (no output)"
            });
        });

    } catch (error) {
        return res.json({
            success: false,
            output: "Server error: " + error.message
        });
    }
});