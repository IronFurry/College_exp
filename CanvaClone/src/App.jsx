import Editor from "@monaco-editor/react";
import { useState } from "react";
import "./App.css";

const templates = {
  python: `print("Hello, SlideShell!")`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, SlideShell!");
    }
}`,
  c: `#include <stdio.h>

int main() {
    printf("Hello, SlideShell!\\n");
    return 0;
}`
};

const App = () => {
  const [code, setCode] = useState(templates.python);
  const [lang, setLang] = useState("python");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const runCode = async () => {
    try {
      setLoading(true);
      setOutput("Running...");

      const response = await fetch("http://localhost:5000/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: code,
          language: lang
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setOutput(data.output || "No output");

    } catch (error) {
      setOutput(`Error: ${error.message}\n\nMake sure the server is running on port 5000`);
    } finally {
      setLoading(false);
    }
  };

  const changeLanguage = (language) => {
    setLang(language);
    setCode(templates[language]);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>SlideShell Compiler</h2>

      <div style={{ marginBottom: "10px" }}>
        <button
          onClick={() => changeLanguage("python")}
          disabled={loading}
          style={{
            background: lang === "python" ? "black" : "white",
            color: lang === "python" ? "white" : "black",
            padding: "8px 16px",
            marginRight: "5px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          Python
        </button>

        <button
          onClick={() => changeLanguage("java")}
          disabled={loading}
          style={{
            background: lang === "java" ? "black" : "white",
            color: lang === "java" ? "white" : "black",
            padding: "8px 16px",
            marginRight: "5px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          Java
        </button>

        <button
          onClick={() => changeLanguage("c")}
          disabled={loading}
          style={{
            background: lang === "c" ? "black" : "white",
            color: lang === "c" ? "white" : "black",
            padding: "8px 16px",
            marginRight: "5px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          C
        </button>

        <button 
          onClick={runCode}
          disabled={loading}
          style={{
            background: "#28a745",
            color: "white",
            padding: "8px 16px",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>

      <Editor
        height="60vh"
        theme="vs-dark"
        language={lang}
        value={code}
        onChange={(value) => setCode(value || "")}
      />
      
      <div style={{
        background: "#111",
        color: "#0f0",
        padding: "10px",
        marginTop: "10px",
        minHeight: "100px",
        fontFamily: "monospace",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}>
        <strong>Output:</strong>
        <pre style={{ margin: "5px 0 0 0" }}>{output}</pre>
      </div>
    </div>
  );
};

export default App;