// const {exec} = require("child_process");
// const { error, log } = require("console");
// const { stderr, stdout } = require("process");

// exec("python --version", (error ,stdout ,stderr)=>{
//     if(error){
//         console.log("Error:", error.message)
//         return
//     }
//     if(stderr){
//         console.log("Stderr:", stderr)
//         return
//     }
//     console.log(stdout);
// })

// const fs = require("fs");

// fs.writeFileSync("Main.py", "print('hello world!')")
// console.log("File created")


// const {exec} = require("child_process");
// const { error } = require("console");

// exec("python Main.py",{timeout:5000},(error ,stdout,stderr)=>{
//     if(error){
//         if(error.killed){
//             console.log("Killed the process")
//         }
//         else{
//             console.log("Error:",error)
//         }
//     }
//     if(stderr){
//         console.log("stderr:",stderr)
//     }
//     console.log(stdout)
// })

const {spawn} = require("child_process");

const fs = require("fs")

const code = `a = input("Enter your name")
print(f"Hello,{a}")`

fs.writeFileSync("test.py",code)

const py = spawn("python",["test.py"])

const userinput = "aryan"
py.stdin.write(userinput);
py.stdin.end();

py.stdout.on("data", (data) => {
    console.log("stdout:", data.toString());
});

py.stderr.on("data", (data) => {
    console.log("stderr:", data.toString());
});