// ========================================
// JCIN UNIBEN QUIZ
// ========================================

// SUPABASE CONFIGURATION
const SUPABASE_URL = "https://eroogvrsmlfpcdmnvxsf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_EwKWVrQlbM7EzmKVdKHS_Q_nHSKigzb";

// SUPABASE CLIENT
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// QUIZ STATE
let questions = [];
let currentQuestion = 0;
let answers = {};
let participantName = "";
let participantEmail = "";

// HTML ELEMENTS
const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");

const startBtn = document.getElementById("start-btn");
const previousBtn = document.getElementById("previous-btn");
const nextBtn = document.getElementById("next-btn");
const submitBtn = document.getElementById("submit-btn");


// ========================================
// LOAD QUESTIONS FROM SUPABASE
// ========================================

async function loadQuestions() {
    const { data, error } = await supabaseClient
        .from("quiz_questions_mini")
        .select("id, question, options")
        .order("id", { ascending: true });

    if (error) {
        throw error;
    }

    if (!data || data.length === 0) {
        throw new Error("No quiz questions were found.");
    }

    questions = data;
}


// ========================================
// START QUIZ
// ========================================

startBtn.addEventListener("click", async () => {
    const nameInput = document.getElementById("participant-name");
    const emailInput = document.getElementById("participant-email");
    const errorElement = document.getElementById("start-error");

    participantName = nameInput.value.trim();
    participantEmail = emailInput.value.trim();

    errorElement.textContent = "";

    if (participantName.length < 2) {
        errorElement.textContent = "Please enter your full name.";
        nameInput.focus();
        return;
    }

    if (!participantEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(participantEmail)) {
        errorElement.textContent = "Please enter a valid email address.";
        emailInput.focus();
        return;
    }

    startBtn.disabled = true;
    startBtn.textContent = "Loading quiz...";

    try {
        await loadQuestions();

        currentQuestion = 0;
        answers = {};

        startScreen.classList.add("hidden");
        quizScreen.classList.remove("hidden");

        renderQuestion();

    } catch (error) {
        console.error("Quiz loading error:", error);

        errorElement.textContent =
            "Unable to load questions. Please check your connection and try again.";

    } finally {
        startBtn.disabled = false;
        startBtn.textContent = "Start Quiz →";
    }
});


// ========================================
// DISPLAY QUESTION
// ========================================

function renderQuestion() {
    const question = questions[currentQuestion];

    const total = questions.length;
    const number = currentQuestion + 1;

    document.getElementById("question-counter").textContent =
        `Question ${number} of ${total}`;

    document.getElementById("question-number").textContent =
        `QUESTION ${String(number).padStart(2, "0")}`;

    document.getElementById("question-text").textContent =
        question.question;

    document.getElementById("progress-bar").style.width =
        `${(number / total) * 100}%`;

    const optionsContainer =
        document.getElementById("options-container");

    optionsContainer.innerHTML = "";

    // Keep options in A, B, C, D order
    const options = Object.entries(question.options).sort(
        ([letterA], [letterB]) => letterA.localeCompare(letterB)
    );

    options.forEach(([letter, value]) => {
        const label = document.createElement("label");
        label.className = "option";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "question-option";
        radio.value = letter;

        if (answers[question.id] === letter) {
            radio.checked = true;
            label.classList.add("selected");
        }

        radio.addEventListener("change", () => {
            answers[question.id] = letter;

            document.querySelectorAll(".option").forEach(option => {
                option.classList.remove("selected");
            });

            label.classList.add("selected");

            document.getElementById("answer-error").textContent = "";
        });

        const letterSpan = document.createElement("span");
        letterSpan.className = "option-letter";
        letterSpan.textContent = letter + ".";

        const textSpan = document.createElement("span");
        textSpan.textContent = value;

        label.appendChild(radio);
        label.appendChild(letterSpan);
        label.appendChild(textSpan);

        optionsContainer.appendChild(label);
    });

    previousBtn.disabled = currentQuestion === 0;

    if (currentQuestion === total - 1) {
        nextBtn.classList.add("hidden");
        submitBtn.classList.remove("hidden");
    } else {
        nextBtn.classList.remove("hidden");
        submitBtn.classList.add("hidden");
    }

    document.getElementById("answer-error").textContent = "";
}


// ========================================
// QUESTION NAVIGATION
// ========================================

nextBtn.addEventListener("click", () => {
    const question = questions[currentQuestion];

    if (!answers[question.id]) {
        document.getElementById("answer-error").textContent =
            "Please select an answer before continuing.";
        return;
    }

    currentQuestion++;
    renderQuestion();
});


previousBtn.addEventListener("click", () => {
    if (currentQuestion > 0) {
        currentQuestion--;
        renderQuestion();
    }
});


// ========================================
// SUBMIT QUIZ
// ========================================

submitBtn.addEventListener("click", async () => {
    const question = questions[currentQuestion];

    if (!answers[question.id]) {
        document.getElementById("answer-error").textContent =
            "Please select an answer before submitting.";
        return;
    }

    const unanswered = questions.filter(
        item => !answers[item.id]
    );

    if (unanswered.length > 0) {
        document.getElementById("answer-error").textContent =
            `You still have ${unanswered.length} unanswered question(s).`;

        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to submit your quiz?"
    );

    if (!confirmed) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/submit-quiz`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    full_name: participantName,
                    email: participantEmail,
                    answers: answers
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Submission failed.");
        }

        // DISPLAY RESULT
        quizScreen.classList.add("hidden");
        resultScreen.classList.remove("hidden");

        document.getElementById("result-name").textContent =
            `Well done, ${participantName}.`;

        document.getElementById("final-score").textContent =
            `${result.score}/${result.total_questions}`;

        document.getElementById("result-message").textContent =
            "Your quiz has been successfully submitted. Thank you for participating.";

    } catch (error) {
        console.error("Submission error:", error);

        document.getElementById("answer-error").textContent =
            error.message || "Something went wrong. Please try again.";

        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Quiz";
    }
});