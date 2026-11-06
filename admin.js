
const SUPABASE_URL = "https://eroogvrsmlfpcdmnvxsf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_EwKWVrQlbM7EzmKVdKHS_Q_nHSKigzb";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// HTML ELEMENTS
const loginScreen = document.getElementById("login-screen");
const dashboardScreen = document.getElementById("dashboard-screen");

const loginForm = document.getElementById("login-form");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const loginError = document.getElementById("login-error");
const dashboardError = document.getElementById("dashboard-error");

const resultsBody = document.getElementById("results-body");
const searchInput = document.getElementById("search-input");
const exportBtn = document.getElementById("export-btn");

let allResults = [];


// ========================================
// SHOW LOGIN OR DASHBOARD
// ========================================

function showLogin() {
    loginScreen.classList.remove("hidden");
    dashboardScreen.classList.add("hidden");
}

function showDashboard() {
    loginScreen.classList.add("hidden");
    dashboardScreen.classList.remove("hidden");
}


// ========================================
// ADMIN LOGIN
// ========================================

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    loginError.textContent = "";

    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        const userEmail = data.user?.email?.toLowerCase();

        if (!userEmail) {
            await supabaseClient.auth.signOut();
            throw new Error("Unable to verify your account.");
        }

        showDashboard();
        await loadResults();

    } catch (error) {
        console.error(error);
        loginError.textContent = error.message || "Login failed.";

    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign In →";
    }
});


// ========================================
// LOAD RESULTS
// ========================================

async function loadResults() {
    dashboardError.textContent = "";
    resultsBody.innerHTML = `
        <tr><td colspan="5">Loading results...</td></tr>
    `;

    try {
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        const session = sessionData.session;

        if (!session) {
            showLogin();
            return;
        }

        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/admin-results`,
            {
                method: "GET",
                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": `Bearer ${session.access_token}`
                }
            }
        );

        const result = await response.json();

        if (response.status === 401) {
            await supabaseClient.auth.signOut();
            showLogin();
            throw new Error("Your session has expired. Please sign in again.");
        }

        if (!response.ok) {
            throw new Error(result.error || "Unable to load results.");
        }

        allResults = result.results || [];

        updateStatistics();
        renderResults(allResults);

    } catch (error) {
        console.error(error);

        dashboardError.textContent =
            error.message || "Something went wrong while loading results.";

        resultsBody.innerHTML = `
            <tr><td colspan="5">Could not load results.</td></tr>
        `;
    }
}


// ========================================
// PARTICIPANT DETAILS
// ========================================

function getParticipant(row) {
    const participant = row.participants;

    if (Array.isArray(participant)) {
        return participant[0] || {};
    }

    return participant || {};
}


// ========================================
// UPDATE STATISTICS
// ========================================

function updateStatistics() {
    const total = allResults.length;

    const average = total > 0
        ? allResults.reduce((sum, row) => sum + Number(row.score || 0), 0) / total
        : 0;

    const highest = total > 0
        ? Math.max(...allResults.map(row => Number(row.score || 0)))
        : 0;

    const totalQuestions = Number(allResults[0]?.total_questions || 40);

    document.getElementById("total-participants").textContent = total;

    document.getElementById("average-score").textContent =
        `${average.toFixed(1)}/${totalQuestions}`;

    document.getElementById("highest-score").textContent =
        `${highest}/${totalQuestions}`;
}


// ========================================
// DISPLAY RESULTS
// ========================================

function renderResults(results) {
    resultsBody.innerHTML = "";

    if (results.length === 0) {
        resultsBody.innerHTML = `
            <tr><td colspan="5">No submissions found.</td></tr>
        `;

        document.getElementById("result-count").textContent =
            "Showing 0 participants.";

        return;
    }

    results.forEach((row, index) => {
        const participant = getParticipant(row);

        const tr = document.createElement("tr");

        const values = [
            index + 1,
            participant.full_name || "Unknown",
            participant.email || "No email",
            `${row.score}/${row.total_questions}`,
            row.submitted_at
                ? new Date(row.submitted_at).toLocaleString()
                : "Unknown"
        ];

        values.forEach((value, cellIndex) => {
            const td = document.createElement("td");
            td.textContent = value;

            if (cellIndex === 3) {
                td.className = "score";
            }

            tr.appendChild(td);
        });

        resultsBody.appendChild(tr);
    });

    document.getElementById("result-count").textContent =
        `Showing ${results.length} of ${allResults.length} submissions.`;
}


// ========================================
// SEARCH
// ========================================

searchInput.addEventListener("input", () => {
    const searchTerm = searchInput.value.trim().toLowerCase();

    const filtered = allResults.filter(row => {
        const participant = getParticipant(row);

        return (
            (participant.full_name || "").toLowerCase().includes(searchTerm) ||
            (participant.email || "").toLowerCase().includes(searchTerm)
        );
    });

    renderResults(filtered);
});


// ========================================
// EXPORT CSV
// ========================================

function escapeCSV(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

exportBtn.addEventListener("click", () => {
    if (allResults.length === 0) {
        alert("There are no results to export.");
        return;
    }

    const headers = [
        "Full Name",
        "Email",
        "Score",
        "Total Questions",
        "Submission Date"
    ];

    const rows = allResults.map(row => {
        const participant = getParticipant(row);

        return [
            participant.full_name,
            participant.email,
            row.score,
            row.total_questions,
            row.submitted_at
        ];
    });

    const csv = [
        headers.map(escapeCSV).join(","),
        ...rows.map(row => row.map(escapeCSV).join(","))
    ].join("\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "JCIN-UNIBEN-Quiz-Results.csv";
    link.click();

    URL.revokeObjectURL(url);
});


// ========================================
// LOGOUT
// ========================================

logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();

    allResults = [];
    showLogin();
});


// ========================================
// CHECK EXISTING SESSION
// ========================================

async function initializeAdmin() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        showLogin();
        return;
    }

    showDashboard();
    await loadResults();
}

initializeAdmin();
