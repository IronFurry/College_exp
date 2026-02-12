const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Your React dev server
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Detection patterns for input functions
const inputPatterns = {
    python: /input\s*\(/,
    java: /(Scanner|BufferedReader|Console|System\.in)/,
    c: /(scanf|gets|getchar|fgets|getline)/
};

// Check if code needs input
function needsInput(code, language) {
    const pattern = inputPatterns[language];
    return pattern ? pattern.test(code) : false;
}

// Non-interactive execution (existing logic)
app.post('/run', (req, res) => {
    const { code, language } = req.body;

    if (!code || !language) {
        return res.json({
            success: false,
            output: "Missing code or language"
        });
    }

    // Check if code needs input
    if (needsInput(code, language)) {
        return res.json({
            success: true,
            needsInput: true,
            message: "This program requires input. Use interactive mode."
        });
    }

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

        exec(command, { timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            // Cleanup
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

// WebSocket for interactive execution
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    let childProcess = null;
    let filePath = null;
    let execId = null;

    socket.on('run-interactive', ({ code, language }) => {
        execId = randomUUID();
        let command = "";
        let args = [];

        try {
            if (language === "python") {
                filePath = path.join(tempDir, `temp_${execId}.py`);
                fs.writeFileSync(filePath, code);
                command = "python";
                args = [filePath];
            }
            else if (language === "java") {
                filePath = path.join(tempDir, `Main_${execId}.java`);
                fs.writeFileSync(filePath, code);
                
                // First compile
                exec(`javac "${filePath}"`, (error, stdout, stderr) => {
                    if (error || stderr) {
                        socket.emit('output', { data: stderr || error.message, type: 'error' });
                        socket.emit('execution-complete');
                        return;
                    }
                    
                    // Then run
                    command = "java";
                    args = ["-cp", tempDir, `Main_${execId}`];
                    startProcess();
                });
                return;
            }
            else if (language === "c") {
                filePath = path.join(tempDir, `temp_${execId}.c`);
                const exePath = path.join(tempDir, `temp_${execId}`);
                fs.writeFileSync(filePath, code);
                
                // First compile
                const compileCmd = process.platform === "win32"
                    ? `gcc "${filePath}" -o "${exePath}.exe"`
                    : `gcc "${filePath}" -o "${exePath}"`;
                
                exec(compileCmd, (error, stdout, stderr) => {
                    if (error || stderr) {
                        socket.emit('output', { data: stderr || error.message, type: 'error' });
                        socket.emit('execution-complete');
                        return;
                    }
                    
                    // Then run
                    command = process.platform === "win32" ? `${exePath}.exe` : exePath;
                    args = [];
                    startProcess();
                });
                return;
            }

            startProcess();

            function startProcess() {
                childProcess = spawn(command, args, {
                    cwd: tempDir
                });

                childProcess.stdout.on('data', (data) => {
                    socket.emit('output', { data: data.toString(), type: 'stdout' });
                });

                childProcess.stderr.on('data', (data) => {
                    socket.emit('output', { data: data.toString(), type: 'stderr' });
                });

                childProcess.on('close', (code) => {
                    socket.emit('execution-complete', { code });
                    cleanup();
                });

                childProcess.on('error', (error) => {
                    socket.emit('output', { data: error.message, type: 'error' });
                    socket.emit('execution-complete');
                    cleanup();
                });

                // Set timeout
                setTimeout(() => {
                    if (childProcess && !childProcess.killed) {
                        childProcess.kill();
                        socket.emit('output', { data: '\nExecution timeout (10s limit)', type: 'error' });
                        socket.emit('execution-complete');
                    }
                }, 10000);
            }

        } catch (error) {
            socket.emit('output', { data: "Server error: " + error.message, type: 'error' });
            socket.emit('execution-complete');
        }
    });

    // Receive input from client
    socket.on('input', (data) => {
        if (childProcess && childProcess.stdin.writable) {
            childProcess.stdin.write(data + '\n');
        }
    });

    // Stop execution
    socket.on('stop-execution', () => {
        if (childProcess && !childProcess.killed) {
            childProcess.kill();
            socket.emit('execution-complete');
            cleanup();
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (childProcess && !childProcess.killed) {
            childProcess.kill();
        }
        cleanup();
    });

    function cleanup() {
        try {
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
            
            if (execId) {
                const classFile = path.join(tempDir, `Main_${execId}.class`);
                if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
                
                const exePath = path.join(tempDir, `temp_${execId}${process.platform === "win32" ? ".exe" : ""}`);
                if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
            }
        } catch (err) {
            console.error("Cleanup error:", err);
        }
    }
});

server.listen(5000, () => {
    console.log("Server running on port 5000");
});