const puppeteer = require('puppeteer');
const readline = require('readline');

// Setup readline for terminal input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

(async () => {
    const DIR = {
        email: 'ruan.nienaber@mundaringcc.wa.edu.au',
        password: '6457Backup',

        login_url: 'https://app.educationperfect.com/app/login',

        username_css: '#loginId',
        password_css: '#password',

        baseList_css: 'div.baseLanguage',
        targetList_css: 'div.targetLanguage',
        start_button_css: 'button#start-button-main',

        modal_question_css: 'td#question-field',
        modal_correct_answer_css: 'td#correct-answer-field',
        modal_user_answered_css: 'td#users-answer-field',
        modal_css: 'div[uib-modal-window=modal-window]',
        modal_backdrop_css: 'div[uib-modal-backdrop=modal-backdrop]',

        question_css: '#question-text',
        answer_box_css: 'input#answer-text',

        exit_button_css: 'button.exit-button',
        exit_continue_button_css: 'button.continue-button',

        continue_button_css: 'button#continue-button',
    }

    puppeteer.launch({
        headless: false,
        defaultViewport: null,
        handleSIGINT: false
    })
    .then(async browser => {
        const page = (await browser.pages())[0];

        console.log('Opening EP page...');
        await page.goto(DIR.login_url);
        console.log('Waiting for login page to load...');
        await page.waitForSelector(DIR.username_css);

        console.log('Filling in login details...');
        await page.type(DIR.username_css, DIR.email);
        await page.type(DIR.password_css, DIR.password);
        await page.keyboard.press('Enter');

        console.log('Waiting for home page to load...');
        setTimeout(() => {
            console.log("This message is delayed by 5 seconds");
        }, 5000); // 5000 milliseconds = 5 seconds        
        console.log('EP Home page load after 5 seconds?; Logged in.');

        let TOGGLE = true;
        let ENTER = true;
        let fullDict = {};
        let cutDict = {};

        function cleanString(string) {
            return String(string)
                .replace(/\([^)]*\)/g, "").trim()
                .split(";")[0].trim()
                .split(",")[0].trim()
                .split("|")[0].trim();
        }

        async function wordList(selector) {
            return await page.$$eval(selector, els => {
                let words = [];
                els.forEach(i => words.push(i.textContent));
                return words;
            });
        }

        async function refreshWords() {
            const l1 = await wordList(DIR.baseList_css);
            const l2 = await wordList(DIR.targetList_css);
            for (let i = 0; i < l1.length; i++) {
                fullDict[l2[i]] = cleanString(l1[i]);
                fullDict[l1[i]] = cleanString(l2[i]);
                cutDict[cleanString(l2[i])] = cleanString(l1[i]);
                cutDict[cleanString(l1[i])] = cleanString(l2[i]);
            }
            console.log('Word Lists Refreshed.');
            await alert('Word Lists Refreshed.');
        }

        async function getModalAnswered() {
            return await page.$$eval('td#users-answer-field > *', el => {
                let answered = '';
                el.forEach(i => {
                    if (i.textContent !== null && i.style.color !== 'rgba(0, 0, 0, 0.25)') answered = answered + i.textContent;
                })
                return answered;
            });
        }

        async function correctAnswer(question, answer) {
            await page.waitForFunction((css) => {
                return document.querySelector(css).textContent !== "blau";
            }, {}, DIR.modal_question_css);

            let modalQuestion = await page.$eval(DIR.modal_question_css, el => el.textContent);
            let modalAnswer = await page.$eval(DIR.modal_correct_answer_css, el => el.textContent);
            let modalCutAnswer = cleanString(modalAnswer);
            let modalAnswered = await getModalAnswered();

            await page.$eval(DIR.continue_button_css, el => el.disabled = false);
            await page.click(DIR.continue_button_css);

            fullDict[question] = modalCutAnswer;

            let log = "===== Details after Incorrect Answer: =====\n"
            log += `Detected Question: \n => ${question}\n`;
            log += `Inputted Answer: \n => ${answer}\n\n`;
            log += `Modal Question: \n => ${modalQuestion}\n`;
            log += `Modal Full Answer: \n => ${modalAnswer}\n`;
            log += `Modal Cut Answer: \n => ${modalCutAnswer}\n`;
            log += `Modal Detected Answered: \n => ${modalAnswered}\n\n\n`;

            console.log(log);
        }

        async function deleteModals() {
            await page.$$eval(DIR.modal_css, el => {
                el.forEach(i => i.remove())
            });
            await page.$$eval(DIR.modal_backdrop_css, el => {
                el.forEach(i => i.remove())
            });
        }

        function findAnswer(question) {
            let answer = fullDict[question];
            if (answer) return answer;
            answer = fullDict[question.replace(",", ";")];
            if (answer) return answer;
            answer = cutDict[cleanString(question)];
            if (answer) return answer;
            console.log(`No answer found for ${question}`);
            return "idk answer";
        }

        async function answerLoop() {
            if (TOGGLE) throw Error("Tried to initiate answerLoop while it is already running");

            TOGGLE = true;
            console.log("answerLoop entered.");

            while (TOGGLE) {
                let question = await page.$eval(DIR.question_css, el => el.textContent);
                let answer = findAnswer(question);

                await page.click(DIR.answer_box_css, {clickCount: 3});
                await page.keyboard.sendCharacter(answer);
                ENTER && page.keyboard.press('Enter');

                if (await page.$(DIR.modal_css)) {
                    if (await page.$(DIR.modal_question_css) !== null) {
                        await correctAnswer(question, answer);
                        await deleteModals();
                    } else if (await page.$(DIR.exit_button_css)) {
                        await page.click(DIR.exit_button_css);
                        break;
                    } else if (await page.$(DIR.exit_continue_button_css)) {
                        await page.click(DIR.exit_continue_button_css);
                        break;
                    } else {
                        await deleteModals();
                    }
                }
            }

            await deleteModals();
            TOGGLE = false;
            console.log('answerLoop Exited.');
        }

        async function toggleLoop() {
            if (TOGGLE) {
                TOGGLE = false;
                console.log("Stopping answerLoop.");
            } else {
                console.log("Starting answerLoop.");
                answerLoop().catch(e => {
                    console.error(e);
                    TOGGLE = false
                });
            }
        }

        async function toggleAuto() {
            if (ENTER) {
                ENTER = false;
                console.log("Switched to semi-auto mode.");
            } else {
                ENTER = true;
                console.log("Switched to auto mode.");
            }
        }

        async function alert(msg) {
            await page.evaluate(m => window.alert(m), msg);
        }

        await page.exposeFunction('refresh', refreshWords);
        await page.exposeFunction('startAnswer', toggleLoop);
        await page.exposeFunction('toggleMode', toggleAuto);

        await page.evaluate(() => {
            document.addEventListener("keyup", async (event) => {
                let key = event.key.toLowerCase();
                if (key !== 'alt') {
                    if ((event.altKey && key === "r") || (key === "®")) {
                        await window.refresh();
                    } else if ((event.altKey && key === "s") || (key === "ß")) {
                        await window.startAnswer();
                    } else if ((event.altKey && key === "a") || (key === "å")) {
                        await window.toggleMode();
                    }
                }
            });
        });

        console.log('Education Perfected V2 fully Loaded.');

        // Terminal input handling
        rl.on('line', async (input) => {
            const command = input.trim().toLowerCase();
            if (command === 'enter') {
                // Fetch the question, find the answer, and input it
                let question = await page.$eval(DIR.question_css, el => el.textContent);
                let answer = findAnswer(question);

                await page.click(DIR.answer_box_css, {clickCount: 3});
                await page.keyboard.sendCharacter(answer);
                await page.keyboard.press('Enter');
                console.log(`Entered answer: ${answer}`);
            } else if (command === 'refresh') {
                await refreshWords();
            } else if (command === 'start') {
                await toggleLoop();
            } else if (command === 'mode') {
                await toggleAuto();
            } else {
                console.log(`Unknown command: ${command}`);
            }
        });
    });
})();
