// ====================================
// Global Variables for Charts and Funds
// ====================================
let sipChart, lumpsumChart, loanChart, swpPieChart;
let allFunds = []; // Global store for mutual fund data

// ====================================
// Helper Functions
// ====================================
function parseDate(str) {
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    str = convertAPIDate(str);
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) console.error("Invalid date string:", str);
  return d;
}

function formatDate(date) {
  if (!date || isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function convertAPIDate(apiDateStr) {
  if (!apiDateStr || typeof apiDateStr !== "string") return "";
  const parts = apiDateStr.split("-");
  if (parts.length !== 3) return "";
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function normalizeData(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null && data.data && Array.isArray(data.data)) {
    return data.data;
  }
  throw new Error("Invalid data structure received from API");
}

function getNAVForDate(navData, dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    dateStr = convertAPIDate(dateStr);
  }
  let exact = navData.find(entry => entry.date === dateStr);
  if (exact && !isNaN(parseFloat(exact.nav))) return parseFloat(exact.nav);
  let filtered = navData.filter(entry => entry.date < dateStr && entry.date !== "");
  if (filtered.length > 0) return parseFloat(filtered[filtered.length - 1].nav);
  return parseFloat(navData[0].nav);
}

// Format numbers using Indian numbering (e.g., 1,23,456.00)
function formatIndianCurrency(num) {
  let x = Number(num).toFixed(2);
  let parts = x.split(".");
  let lastThree = parts[0].slice(-3);
  let otherNumbers = parts[0].slice(0, -3);
  if(otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  let formatted = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return "₹" + formatted + "." + parts[1];
}

// ====================================
// Chart Update Functions
// ====================================
function updateSIPChart(labels, investedData, portfolioData) {
  const ctx = document.getElementById("sipChart").getContext("2d");
  if (sipChart) sipChart.destroy();
  sipChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "Total Invested", data: investedData, borderColor: "#0077CC", backgroundColor: "rgba(0,119,204,0.2)", fill: false, tension: 0.1 },
        { label: "Portfolio Value", data: portfolioData, borderColor: "#FF6600", backgroundColor: "rgba(255,102,0,0.2)", fill: false, tension: 0.1 }
      ]
    },
    options: {
      scales: {
        x: { ticks: { color: "#222" }, grid: { color: "#ccc" } },
        y: { ticks: { color: "#222" }, grid: { color: "#ccc" } }
      },
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
  document.getElementById("sipChart").style.display = "block";
}

function updateLumpsumChart(labels, portfolioData) {
  const ctx = document.getElementById("lumpsumChart").getContext("2d");
  if (lumpsumChart) lumpsumChart.destroy();
  lumpsumChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "Portfolio Value", data: portfolioData, borderColor: "#FF6600", backgroundColor: "rgba(255,102,0,0.2)", fill: false, tension: 0.1 }
      ]
    },
    options: {
      scales: {
        x: { ticks: { color: "#222" }, grid: { color: "#ccc" } },
        y: { ticks: { color: "#222" }, grid: { color: "#ccc" } }
      },
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
  document.getElementById("lumpsumChart").style.display = "block";
}

function updateLoanChart(labels, dataPoints) {
  const ctx = document.getElementById("loanChart").getContext("2d");
  if (loanChart) loanChart.destroy();
  loanChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        { label: "EMI Variation", data: dataPoints, borderColor: "#0077CC", backgroundColor: "rgba(0,119,204,0.2)", fill: false, tension: 0.1 }
      ]
    },
    options: {
      scales: {
        x: { ticks: { color: "#222" }, grid: { color: "#ccc" } },
        y: { ticks: { color: "#222" }, grid: { color: "#ccc" } }
      },
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
  document.getElementById("loanChart").style.display = "block";
}

function updateSWPPieChart(totalWithdrawals, finalPortfolio) {
  const ctx = document.getElementById("swpPieChart").getContext("2d");
  if (swpPieChart) swpPieChart.destroy();
  swpPieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Total Withdrawals", "Current Portfolio"],
      datasets: [{
        data: [totalWithdrawals, finalPortfolio],
        backgroundColor: ["#FF6600", "#0077CC"]
      }]
    },
    options: {
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
  document.getElementById("swpPieChart").style.display = "block";
}

// ====================================
// Mutual Fund List & Filtering for Mobile
// ====================================
function populateFundList() {
  fetch("https://api.mfapi.in/mf")
    .then(response => response.json())
    .then(data => {
      allFunds = data.map(fund => {
        let schemeName = fund.schemeName || (fund.meta && fund.meta.scheme_name);
        let schemeCode = fund.schemeCode || (fund.meta && fund.meta.scheme_code);
        return { schemeName, schemeCode };
      }).filter(fund => fund.schemeName && fund.schemeCode);
      filterFundList("");
    })
    .catch(err => console.error("Error populating fund list:", err));
}
document.addEventListener("DOMContentLoaded", populateFundList);
function filterFundList(query) {
  const fundList = document.getElementById("fundList");
  fundList.innerHTML = "";
  const filtered = allFunds.filter(fund => fund.schemeName.toLowerCase().includes(query.toLowerCase()));
  const limited = filtered.slice(0, 100);
  limited.forEach(fund => {
    const option = document.createElement("option");
    option.value = fund.schemeName;
    option.setAttribute("data-id", fund.schemeCode);
    fundList.appendChild(option);
  });
}
document.getElementById("fundNameInput").addEventListener("input", function() {
  filterFundList(this.value);
});
function getSelectedFundId() {
  const input = document.getElementById("fundNameInput");
  const datalist = document.getElementById("fundList");
  const options = datalist.options;
  console.log("User input fund name:", input.value);
  for (let i = 0; i < options.length; i++) {
    if (options[i].value.trim().toLowerCase() === input.value.trim().toLowerCase()) {
      const fundId = options[i].getAttribute("data-id");
      console.log("Matched fund ID:", fundId);
      return fundId;
    }
  }
  console.warn("No matching fund ID found for input:", input.value);
  return null;
}

// ====================================
// Historical NAV Data Fetching
// ====================================
function fetchHistoricalData(fundId) {
  const cacheKey = `historicalData_${fundId}`;
  const today = new Date().toISOString().split("T")[0];
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const cachedObj = JSON.parse(cached);
    if (cachedObj.lastUpdated === today) return Promise.resolve(cachedObj.data);
  }
  const apiUrl = `https://api.mfapi.in/mf/${fundId}`;
  console.log("Fetching historical data from:", apiUrl);
  return fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      let normalized = normalizeData(data);
      normalized = normalized.map(entry => ({ ...entry, date: convertAPIDate(entry.date) }));
      normalized = normalized.filter(entry => !isNaN(parseDate(entry.date).getTime()));
      normalized.sort((a, b) => parseDate(a.date) - parseDate(b.date));
      localStorage.setItem(cacheKey, JSON.stringify({ lastUpdated: today, data: normalized }));
      return normalized;
    });
}

// ====================================
// Latest NAV Data Fetching
// ====================================
function fetchLatestNAV(fundId) {
  const apiUrl = `https://api.mfapi.in/mf/${fundId}`;
  console.log("Fetching latest NAV from:", apiUrl);
  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      let normalized = normalizeData(data);
      normalized = normalized.map(entry => ({ ...entry, date: convertAPIDate(entry.date) }));
      const latestData = normalized[0];
      if (!latestData) throw new Error("No NAV data available");
      document.getElementById("latestNAV").innerHTML =
        `<p>Latest NAV (as on ${latestData.date}): ${formatIndianCurrency(latestData.nav)}</p>`;
    })
    .catch(err => {
      console.error("Error fetching latest NAV:", err);
      document.getElementById("latestNAV").innerHTML = `<p>Error fetching latest NAV. Please try again later.</p>`;
    });
}
document.getElementById("fundNameInput").addEventListener("change", function () {
  const fundId = getSelectedFundId();
  if (fundId) fetchLatestNAV(fundId);
});

// ====================================
// Step-Up Helper
// ====================================
function getAnniversaryCount(startDate, currentDate) {
  let count = 0;
  let anniversary = new Date(startDate);
  while (anniversary <= currentDate) {
    count++;
    anniversary.setFullYear(anniversary.getFullYear() + 1);
  }
  return count - 1;
}

// ====================================
// SIP Calculator
// ====================================
function calculateSIP(navData, startDateStr, endDateStr, sipAmount, sipType, stepUpPercent = 0) {
  let totalInvested = 0, totalUnits = 0;
  let startDate = parseDate(startDateStr), endDate = parseDate(endDateStr);
  const earliestDate = parseDate(navData[0].date);
  if (startDate < earliestDate) {
    console.warn("Start date is before available data. Using earliest date:", navData[0].date);
    startDate = earliestDate;
  }
  let currentDate = new Date(startDate);
  const dates = [], investedArr = [], portfolioArr = [];
  while (currentDate <= endDate) {
    let currentSipAmount = sipAmount;
    if (sipType === "stepup") {
      const anniversaries = getAnniversaryCount(startDate, currentDate);
      currentSipAmount = sipAmount * Math.pow(1 + (stepUpPercent / 100), anniversaries);
    }
    const dateStr = formatDate(currentDate);
    let navValue = getNAVForDate(navData, dateStr);
    if (!isNaN(navValue)) {
      const units = currentSipAmount / navValue;
      totalUnits += units;
      totalInvested += currentSipAmount;
      dates.push(dateStr);
      investedArr.push(totalInvested.toFixed(2));
      portfolioArr.push((totalUnits * navValue).toFixed(2));
    }
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  const endNAV = getNAVForDate(navData, formatDate(endDate));
  const finalValue = totalUnits * endNAV;
  const totalYears = (endDate - startDate) / (365.25 * 24 * 3600 * 1000);
  const CAGR = Math.pow(finalValue / totalInvested, 1 / totalYears) - 1;
  const returnPct = ((finalValue - totalInvested) / totalInvested) * 100;
  updateSIPChart(dates, investedArr, portfolioArr);
  return {
    totalInvested: totalInvested.toFixed(2),
    finalValue: finalValue.toFixed(2),
    CAGR: (CAGR * 100).toFixed(2),
    returnPct: returnPct.toFixed(2)
  };
}
document.getElementById("calcSIP").addEventListener("click", function () {
  const fundId = getSelectedFundId();
  if (!fundId) { alert("Please select a valid mutual fund from the list."); return; }
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const sipAmount = parseFloat(document.getElementById("sipAmount").value);
  const sipType = document.getElementById("sipType").value;
  const stepUpPercent = sipType === "stepup" ? parseFloat(document.getElementById("stepUpPercent").value) || 0 : 0;
  fetchHistoricalData(fundId)
    .then(navData => {
      const result = calculateSIP(navData, startDate, endDate, sipAmount, sipType, stepUpPercent);
      document.getElementById("sipResult").innerHTML =
        `<h3>SIP Calculation Results:</h3>
         <p>Total Invested: ${formatIndianCurrency(result.totalInvested)}</p>
         <p>Final Value: ${formatIndianCurrency(result.finalValue)}</p>
         <p>CAGR: ${result.CAGR}%</p>
         <p>Return (%): ${result.returnPct}%</p>`;
    })
    .catch(err => {
      console.error("Error fetching historical NAV data:", err);
      document.getElementById("sipResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
    });
});
document.getElementById("sipType").addEventListener("change", function() {
  document.getElementById("stepUpContainer").style.display = this.value === "stepup" ? "block" : "none";
});

// ====================================
// SWP Calculator (Updated)
// ====================================
function calculateSWP(navData, startDateStr, endDateStr, initialPortfolio, withdrawal) {
  let currentPortfolio = initialPortfolio;
  let totalWithdrawals = 0;
  const startDate = parseDate(startDateStr),
        endDate = parseDate(endDateStr);
  let previousNAV = getNAVForDate(navData, formatDate(startDate));
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    const currentNAV = getNAVForDate(navData, dateStr);
    currentPortfolio = currentPortfolio * (currentNAV / previousNAV) - withdrawal;
    totalWithdrawals += withdrawal;
    previousNAV = currentNAV;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  // Total return now calculated as Final - Initial
  const totalReturn = currentPortfolio - initialPortfolio;
  const returnPct = (totalReturn / initialPortfolio) * 100;
  const totalYears = (endDate - startDate) / (365.25 * 24 * 3600 * 1000);
  const CAGR = Math.pow(currentPortfolio / initialPortfolio, 1 / totalYears) - 1;
  
  return {
    finalPortfolio: currentPortfolio.toFixed(2),
    totalWithdrawals: totalWithdrawals.toFixed(2),
    totalReturn: totalReturn.toFixed(2),
    CAGR: (CAGR * 100).toFixed(2),
    returnPct: returnPct.toFixed(2)
  };
}
document.getElementById("calcSWP").addEventListener("click", function () {
  const fundId = getSelectedFundId();
  if (!fundId) { alert("Please select a valid mutual fund for SWP calculations."); return; }
  const swpStartDate = document.getElementById("swpStartDate").value;
  const swpEndDate = document.getElementById("swpEndDate").value;
  const initialPortfolio = parseFloat(document.getElementById("initialPortfolio").value);
  const withdrawal = parseFloat(document.getElementById("withdrawalAmount").value);
  fetchHistoricalData(fundId)
    .then(navData => {
      const result = calculateSWP(navData, swpStartDate, swpEndDate, initialPortfolio, withdrawal);
      document.getElementById("swpResult").innerHTML =
        `<h3>SWP Calculation Results:</h3>
         <p>Final Portfolio Value: ${formatIndianCurrency(result.finalPortfolio)}</p>
         <p>Total Withdrawals: ${formatIndianCurrency(result.totalWithdrawals)}</p>
         <p>Total Return: ${formatIndianCurrency(result.totalReturn)}</p>
         <p>CAGR: ${result.CAGR}%</p>
         <p>Return (%): ${result.returnPct}%</p>`;
      updateSWPPieChart(result.totalWithdrawals, result.finalPortfolio);
    })
    .catch(err => {
      console.error("Error fetching historical NAV data for SWP:", err);
      document.getElementById("swpResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
    });
}

// ====================================
// Lumpsum Calculator
// ====================================
function calculateLumpsum(navData, startDateStr, endDateStr, lumpsumAmount) {
  const startDate = parseDate(startDateStr),
        endDate = parseDate(endDateStr);
  const startNAV = getNAVForDate(navData, formatDate(startDate));
  const endNAV = getNAVForDate(navData, formatDate(endDate));
  const finalValue = lumpsumAmount * (endNAV / startNAV);
  const totalYears = (endDate - startDate) / (365.25 * 24 * 3600 * 1000);
  const CAGR = Math.pow(finalValue / lumpsumAmount, 1 / totalYears) - 1;
  const returnPct = ((finalValue - lumpsumAmount) / lumpsumAmount) * 100;
  return {
    finalValue: finalValue.toFixed(2),
    CAGR: (CAGR * 100).toFixed(2),
    returnPct: returnPct.toFixed(2)
  };
}
function updateLumpsumChart(labels, portfolioData) {
  const ctx = document.getElementById("lumpsumChart").getContext("2d");
  if (lumpsumChart) lumpsumChart.destroy();
  lumpsumChart = new Chart(ctx, {
    type: "line",
    data: { labels: labels, datasets: [ { label: "Portfolio Value", data: portfolioData, borderColor: "#FF6600", backgroundColor: "rgba(255,102,0,0.2)", fill: false, tension: 0.1 } ] },
    options: { scales: { x: { ticks: { color: "#222" }, grid: { color: "#ccc" } }, y: { ticks: { color: "#222" }, grid: { color: "#ccc" } } }, plugins: { legend: { labels: { color: "#222" } } } }
  });
  document.getElementById("lumpsumChart").style.display = "block";
}
document.getElementById("calcLumpsum").addEventListener("click", function () {
  const fundId = getSelectedFundId();
  if (!fundId) { alert("Please select a valid mutual fund for Lumpsum calculations."); return; }
  const startDate = document.getElementById("lumpsumStartDate").value;
  const endDate = document.getElementById("lumpsumEndDate").value;
  const lumpsumAmount = parseFloat(document.getElementById("lumpsumAmount").value);
  fetchHistoricalData(fundId)
    .then(navData => {
      const result = calculateLumpsum(navData, startDate, endDate, lumpsumAmount);
      document.getElementById("lumpsumResult").innerHTML =
        `<h3>Lumpsum Calculation Results:</h3>
         <p>Final Value: ${formatIndianCurrency(result.finalValue)}</p>
         <p>CAGR: ${result.CAGR}%</p>
         <p>Return (%): ${result.returnPct}%</p>`;
      let labels = [];
      let portfolioArr = [];
      let currentDate = new Date(parseDate(startDate));
      const endD = parseDate(endDate);
      const startNAV = getNAVForDate(navData, formatDate(parseDate(startDate)));
      let units = lumpsumAmount / startNAV;
      while (currentDate <= endD) {
        let dStr = formatDate(currentDate);
        let navVal = getNAVForDate(navData, dStr);
        labels.push(dStr);
        portfolioArr.push((units * navVal).toFixed(2));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      updateLumpsumChart(labels, portfolioArr);
    })
    .catch(err => {
      console.error("Error fetching historical NAV data for Lumpsum:", err);
      document.getElementById("lumpsumResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
    });
});

// ====================================
// Goal Based Planner Calculator (Independent)
// ====================================
function simulateSIPForGoal(navData, startDate, endDate, initialSIP, stepUpPercent) {
  let totalInvested = 0, totalUnits = 0;
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    let currentSip = initialSIP * Math.pow(1 + (stepUpPercent / 100), getAnniversaryCount(startDate, currentDate));
    const dStr = formatDate(currentDate);
    let navVal = getNAVForDate(navData, dStr);
    totalUnits += currentSip / navVal;
    totalInvested += currentSip;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  const endNAV = getNAVForDate(navData, formatDate(endDate));
  return totalUnits * endNAV;
}
function calculateLumpsumForGoalUsingHistory(navData, startDate, endDate, target) {
  const startNAV = getNAVForDate(navData, formatDate(startDate));
  const endNAV = getNAVForDate(navData, formatDate(endDate));
  return target * (startNAV / endNAV);
}
function solveRequiredSIPForGoal(target, navData, years, stepUpPercent) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + years);
  let low = 0, high = target / (years * 12), mid;
  for (let i = 0; i < 20; i++) {
    mid = (low + high) / 2;
    const finalVal = simulateSIPForGoal(navData, startDate, endDate, mid, stepUpPercent);
    if (finalVal < target) low = mid; else high = mid;
  }
  return mid;
}
document.getElementById("calcGoal").addEventListener("click", function () {
  const goalOption = document.querySelector('input[name="goalOption"]:checked').value;
  const targetAmount = parseFloat(document.getElementById("targetAmount").value);
  const goalReturn = parseFloat(document.getElementById("goalReturn").value);
  let resultHTML = "<h3>Goal Based Planner Results:</h3>";
  if (goalOption === "investment") {
    const modeSelect = document.getElementById("investmentMode").value;
    const years = parseFloat(document.getElementById("goalYears").value);
    if (modeSelect === "lumpsum") {
      const fundId = getSelectedFundId();
      if (!fundId) { alert("Please select a valid mutual fund for goal planner calculations."); return; }
      fetchHistoricalData(fundId)
        .then(navData => {
          const startDate = new Date(), endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + years);
          const requiredLumpsum = calculateLumpsumForGoalUsingHistory(navData, startDate, endDate, targetAmount);
          resultHTML += `<p>Required Lumpsum Investment: ${formatIndianCurrency(requiredLumpsum)}</p>`;
          document.getElementById("goalResult").innerHTML = resultHTML;
        })
        .catch(err => {
          console.error("Error fetching historical NAV data for Goal Planner:", err);
          document.getElementById("goalResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
        });
      return;
    } else if (modeSelect === "sip") {
      const stepUp = parseFloat(document.getElementById("goalStepUpPercent").value) || 0;
      const fundId = getSelectedFundId();
      if (!fundId) { alert("Please select a valid mutual fund for goal planner calculations."); return; }
      fetchHistoricalData(fundId)
        .then(navData => {
          const requiredSIP = solveRequiredSIPForGoal(targetAmount, navData, years, stepUp);
          resultHTML += `<p>Required Monthly SIP (with ${stepUp}% step-up): ${formatIndianCurrency(requiredSIP)}</p>`;
          document.getElementById("goalResult").innerHTML = resultHTML;
        })
        .catch(err => {
          console.error("Error fetching historical NAV data for Goal Planner:", err);
          document.getElementById("goalResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
        });
      return;
    }
  } else if (goalOption === "time") {
    const modeSelect = document.getElementById("investmentMode").value;
    if (modeSelect === "lumpsum") {
      const lumpsumGiven = parseFloat(document.getElementById("existingLumpsum").value);
      const timeNeeded = calculateTimeForLumpsum(lumpsumGiven, targetAmount, goalReturn);
      resultHTML += `<p>Time Required (Lumpsum): ${timeNeeded.toFixed(2)} years</p>`;
    } else if (modeSelect === "sip") {
      const sipGiven = parseFloat(document.getElementById("existingSIP").value);
      const timeNeeded = calculateTimeForSIP(sipGiven, targetAmount, goalReturn);
      resultHTML += `<p>Time Required (SIP): ${timeNeeded.toFixed(2)} years</p>`;
    }
  } else if (goalOption === "combination") {
    const comboChoice = document.getElementById("comboChoice").value;
    const years = parseFloat(document.getElementById("comboYears").value);
    if (comboChoice === "lumpsum") {
      const lumpsumProvided = parseFloat(document.getElementById("givenLumpsum").value);
      const lumpsumFuture = lumpsumProvided * Math.pow(1 + goalReturn / 100, years);
      const remainingTarget = targetAmount - lumpsumFuture;
      if (remainingTarget <= 0) resultHTML += `<p>Your lumpsum alone meets the target.</p>`;
      else {
        const requiredSIP = calculateMonthlySIPForGoal(remainingTarget, years, goalReturn);
        resultHTML += `<p>Additional required Monthly SIP: ${formatIndianCurrency(requiredSIP)}</p>`;
      }
    } else if (comboChoice === "sip") {
      const sipProvided = parseFloat(document.getElementById("givenSIP").value);
      const r = goalReturn / 100 / 12;
      const n = years * 12;
      const sipFuture = sipProvided * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
      const remainingTarget = targetAmount - sipFuture;
      if (remainingTarget <= 0) resultHTML += `<p>Your SIP alone meets the target.</p>`;
      else {
        const requiredLumpsum = calculateLumpsumForGoal(remainingTarget, years, goalReturn);
        resultHTML += `<p>Additional required Lumpsum Investment: ${formatIndianCurrency(requiredLumpsum)}</p>`;
      }
    }
  }
  document.getElementById("goalResult").innerHTML = resultHTML;
});
  
// ====================================
// Dynamic UI for Goal Based Planner Options
// ====================================
document.querySelectorAll('input[name="goalOption"]').forEach(radio => {
  radio.addEventListener("change", function() {
    const mode = this.value;
    document.getElementById("investmentInputs").style.display = (mode === "investment") ? "block" : "none";
    document.getElementById("timeInputs").style.display = (mode === "time") ? "block" : "none";
    document.getElementById("combinationInputs").style.display = (mode === "combination") ? "block" : "none";
  });
});
document.getElementById("comboChoice").addEventListener("change", function() {
  if (this.value === "lumpsum") {
    document.getElementById("comboLumpsum").style.display = "block";
    document.getElementById("comboSIP").style.display = "none";
  } else if (this.value === "sip") {
    document.getElementById("comboLumpsum").style.display = "none";
    document.getElementById("comboSIP").style.display = "block";
  }
});
document.getElementById("investmentMode").addEventListener("change", function() {
  document.getElementById("goalSipInputs").style.display = this.value === "sip" ? "block" : "none";
});

// ====================================
// Loan Calculator
// ====================================
function calculateLoanEMI(loanAmount, annualInterestRate, tenureYears) {
  const r = annualInterestRate / 100 / 12;
  const n = tenureYears * 12;
  const EMI = loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const totalPayment = EMI * n;
  const totalInterest = totalPayment - loanAmount;
  return { EMI, totalInterest, totalPayment };
}
function calculateLoanTenure(loanAmount, annualInterestRate, EMI) {
  const r = annualInterestRate / 100 / 12;
  const n = Math.log(EMI / (EMI - loanAmount * r)) / Math.log(1 + r);
  return n / 12; // in years
}
function calculateLoanRate(loanAmount, EMI, tenureYears) {
  const n = tenureYears * 12;
  let low = 0, high = 1, mid;
  for (let i = 0; i < 20; i++) {
    mid = (low + high) / 2;
    const EMIcalc = loanAmount * mid * Math.pow(1 + mid, n) / (Math.pow(1 + mid, n) - 1);
    if (EMIcalc > EMI) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return mid * 12 * 100; // convert monthly rate to annual percentage
}
function simulateLoanEMI(loanAmount, annualInterestRate, tenureYears) {
  const dataPoints = [];
  const labels = [];
  for (let rate = annualInterestRate - 2; rate <= annualInterestRate + 2; rate += 0.5) {
    const r = rate / 100 / 12;
    const n = tenureYears * 12;
    const EMI = loanAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    labels.push(rate.toFixed(1) + "%");
    dataPoints.push(EMI.toFixed(2));
  }
  updateLoanChart(labels, dataPoints);
}
document.getElementById("calcLoan").addEventListener("click", function() {
  const loanMode = document.querySelector('input[name="loanMode"]:checked').value;
  if (loanMode === "emi") {
    const loanAmount = parseFloat(document.getElementById("loanAmount").value);
    const loanInterest = parseFloat(document.getElementById("loanInterest").value);
    const loanTenure = parseFloat(document.getElementById("loanTenure").value);
    const result = calculateLoanEMI(loanAmount, loanInterest, loanTenure);
    document.getElementById("loanResult").innerHTML =
      `<h3>Loan Calculator Results (EMI Mode):</h3>
       <p>Monthly EMI: ${formatIndianCurrency(result.EMI)}</p>
       <p>Total Interest Payable: ${formatIndianCurrency(result.totalInterest)}</p>
       <p>Total Payment: ${formatIndianCurrency(result.totalPayment)}</p>`;
    simulateLoanEMI(loanAmount, loanInterest, loanTenure);
  } else if (loanMode === "tenure") {
    const loanAmount = parseFloat(document.getElementById("loanAmount").value);
    const loanInterest = parseFloat(document.getElementById("loanInterest").value);
    const EMI = parseFloat(document.getElementById("loanEMI").value);
    const tenureYears = calculateLoanTenure(loanAmount, loanInterest, EMI);
    document.getElementById("loanResult").innerHTML =
      `<h3>Loan Calculator Results (Tenure Mode):</h3>
       <p>Calculated Loan Tenure: ${tenureYears.toFixed(2)} years</p>`;
    document.getElementById("loanChart").style.display = "none";
  } else if (loanMode === "rate") {
    const loanAmount = parseFloat(document.getElementById("loanAmount").value);
    const EMI = parseFloat(document.getElementById("loanEMI").value);
    const loanTenure = parseFloat(document.getElementById("loanTenure").value);
    const annualRate = calculateLoanRate(loanAmount, EMI, loanTenure);
    document.getElementById("loanResult").innerHTML =
      `<h3>Loan Calculator Results (Rate Mode):</h3>
       <p>Calculated Annual Interest Rate: ${annualRate.toFixed(2)}%</p>`;
    document.getElementById("loanChart").style.display = "none";
  }
});
document.querySelectorAll('input[name="loanMode"]').forEach(radio => {
  radio.addEventListener("change", function() {
    const mode = this.value;
    if (mode === "emi") {
      document.getElementById("loanAmountGroup").style.display = "block";
      document.getElementById("loanInterestGroup").style.display = "block";
      document.getElementById("loanTenureGroup").style.display = "block";
      document.getElementById("loanEMIGroup").style.display = "none";
    } else if (mode === "tenure") {
      document.getElementById("loanAmountGroup").style.display = "block";
      document.getElementById("loanInterestGroup").style.display = "block";
      document.getElementById("loanTenureGroup").style.display = "none";
      document.getElementById("loanEMIGroup").style.display = "block";
    } else if (mode === "rate") {
      document.getElementById("loanAmountGroup").style.display = "block";
      document.getElementById("loanInterestGroup").style.display = "none";
      document.getElementById("loanTenureGroup").style.display = "block";
      document.getElementById("loanEMIGroup").style.display = "block";
    }
  });
});

// ====================================
// Toggle Button Functionality (Fixed)
// ====================================
document.querySelectorAll(".toggle-btn").forEach(btn => {
  btn.addEventListener("click", function() {
    const targetId = this.getAttribute("data-target");
    const content = document.getElementById(targetId);
    // Use computed style to check current display
    const currentDisplay = window.getComputedStyle(content).display;
    content.style.display = (currentDisplay === "none") ? "block" : "none";
  });
});
