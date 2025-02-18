// ====================================
// Global Variables for Charts and Funds
// ====================================
let sipChart, lumpsumChart, loanChart;
let allFunds = []; // Store full mutual fund list

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
  return date.toISOString().split('T')[0];
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) dateStr = convertAPIDate(dateStr);
  let exact = navData.find(entry => entry.date === dateStr);
  if (exact && !isNaN(parseFloat(exact.nav))) return parseFloat(exact.nav);
  let filtered = navData.filter(entry => entry.date < dateStr && entry.date !== "");
  if (filtered.length > 0) return parseFloat(filtered[filtered.length - 1].nav);
  return parseFloat(navData[0].nav);
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
        { label: "Total Invested (₹)", data: investedData, borderColor: "#0077CC", backgroundColor: "rgba(0,119,204,0.2)", fill: false, tension: 0.1 },
        { label: "Portfolio Value (₹)", data: portfolioData, borderColor: "#FF6600", backgroundColor: "rgba(255,102,0,0.2)", fill: false, tension: 0.1 }
      ]
    },
    options: {
      scales: { x: { ticks: { color: "#222" }, grid: { color: "#ccc" } }, y: { ticks: { color: "#222" }, grid: { color: "#ccc" } } },
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
}
function updateLumpsumChart(dates, portfolioData) {
  const ctx = document.getElementById("lumpsumChart").getContext("2d");
  if (lumpsumChart) lumpsumChart.destroy();
  lumpsumChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        { label: "Portfolio Value (₹)", data: portfolioData, borderColor: "#FF6600", backgroundColor: "rgba(255,102,0,0.2)", fill: false, tension: 0.1 }
      ]
    },
    options: {
      scales: { x: { ticks: { color: "#222" }, grid: { color: "#ccc" } }, y: { ticks: { color: "#222" }, grid: { color: "#ccc" } } },
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
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
      scales: { x: { ticks: { color: "#222" }, grid: { color: "#ccc" } }, y: { ticks: { color: "#222" }, grid: { color: "#ccc" } } },
      plugins: { legend: { labels: { color: "#222" } } }
    }
  });
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
  const today = new Date().toISOString().split('T')[0];
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
        `<p>Latest NAV (as on ${latestData.date}): ₹${latestData.nav}</p>`;
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
  return { totalInvested: totalInvested.toFixed(2), finalValue: finalValue.toFixed(2), CAGR: (CAGR * 100).toFixed(2), returnPct: returnPct.toFixed(2) };
}
document.getElementById("calcSIP").addEventListener("click", function () {
  const fundId = getSelectedFundId();
  if (!fundId) { alert("Please select a valid mutual fund from the list."); return; }
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const sipAmount = parseFloat(document.getElementById("sipAmount").value);
  const sipType = document.getElementById("sipType").value;
  const stepUpPercent = sipType === "stepup" ? parseFloat(document.getElementById("stepUpPercent").value) : 0;
  fetchHistoricalData(fundId)
    .then(navData => {
      const result = calculateSIP(navData, startDate, endDate, sipAmount, sipType, stepUpPercent);
      document.getElementById("sipResult").innerHTML =
        `<h3>SIP Calculation Results:</h3>
         <p>Total Invested: ₹${result.totalInvested}</p>
         <p>Final Value: ₹${result.finalValue}</p>
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
// SWP Calculator
// ====================================
function calculateSWP(navData, startDateStr, endDateStr, initialPortfolio, withdrawal) {
  let currentPortfolio = initialPortfolio;
  const startDate = parseDate(startDateStr), endDate = parseDate(endDateStr);
  let previousNAV = getNAVForDate(navData, formatDate(startDate));
  let currentDate = new Date(startDate), monthCount = 0;
  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    const currentNAV = getNAVForDate(navData, dateStr);
    currentPortfolio = currentPortfolio * (currentNAV / previousNAV);
    currentPortfolio -= withdrawal;
    previousNAV = currentNAV;
    monthCount++;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  const totalWithdrawn = withdrawal * monthCount;
  const totalReturn = (currentPortfolio + totalWithdrawn) - initialPortfolio;
  const returnPct = ((currentPortfolio - initialPortfolio) / initialPortfolio) * 100;
  const totalYears = (endDate - startDate) / (365.25 * 24 * 3600 * 1000);
  const CAGR = Math.pow((currentPortfolio + totalWithdrawn) / initialPortfolio, 1 / totalYears) - 1;
  return { finalPortfolio: currentPortfolio.toFixed(2), totalWithdrawn: totalWithdrawn.toFixed(2), totalReturn: totalReturn.toFixed(2), CAGR: (CAGR * 100).toFixed(2), returnPct: returnPct.toFixed(2) };
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
         <p>Total Withdrawn: ₹${result.totalWithdrawn}</p>
         <p>Final Portfolio Value: ₹${result.finalPortfolio}</p>
         <p>Total Return (Final + Withdrawals - Initial): ₹${result.totalReturn}</p>
         <p>CAGR: ${result.CAGR}%</p>
         <p>Return (%): ${result.returnPct}%</p>`;
    })
    .catch(err => {
      console.error("Error fetching historical NAV data for SWP:", err);
      document.getElementById("swpResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
    });
});

// ====================================
// Lumpsum Calculator
// ====================================
function calculateLumpsum(navData, startDateStr, endDateStr, lumpsumAmount) {
  const startDate = parseDate(startDateStr), endDate = parseDate(endDateStr);
  const startNAV = getNAVForDate(navData, formatDate(startDate));
  const endNAV = getNAVForDate(navData, formatDate(endDate));
  const finalValue = lumpsumAmount * (endNAV / startNAV);
  const totalYears = (endDate - startDate) / (365.25 * 24 * 3600 * 1000);
  const CAGR = Math.pow(finalValue / lumpsumAmount, 1 / totalYears) - 1;
  const returnPct = ((finalValue - lumpsumAmount) / lumpsumAmount) * 100;
  return { finalValue: finalValue.toFixed(2), CAGR: (CAGR * 100).toFixed(2), returnPct: returnPct.toFixed(2) };
}
function updateLumpsumChart(navData, startDateStr, endDateStr, lumpsumAmount) {
  let startDate = parseDate(startDateStr), endDate = parseDate(endDateStr);
  const dates = [], portfolioArr = [];
  let currentDate = new Date(startDate);
  const startNAV = getNAVForDate(navData, formatDate(startDate));
  let units = lumpsumAmount / startNAV;
  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate);
    let navValue = getNAVForDate(navData, dateStr);
    const portfolioVal = units * navValue;
    dates.push(dateStr);
    portfolioArr.push(portfolioVal.toFixed(2));
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  const ctx = document.getElementById("lumpsumChart").getContext("2d");
  if (lumpsumChart) lumpsumChart.destroy();
  lumpsumChart = new Chart(ctx, {
    type: "line",
    data: { labels: dates, datasets: [ { label: "Portfolio Value (₹)", data: portfolioArr, borderColor: "#FF6600", backgroundColor: "rgba(255,102,0,0.2)", fill: false, tension: 0.1 } ] },
    options: { scales: { x: { ticks: { color: "#222" }, grid: { color: "#ccc" } }, y: { ticks: { color: "#222" }, grid: { color: "#ccc" } } }, plugins: { legend: { labels: { color: "#222" } } } }
  });
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
         <p>Final Value: ₹${result.finalValue}</p>
         <p>CAGR: ${result.CAGR}%</p>
         <p>Return (%): ${result.returnPct}%</p>`;
      updateLumpsumChart(navData, startDate, endDate, lumpsumAmount);
    })
    .catch(err => {
      console.error("Error fetching historical NAV data for Lumpsum:", err);
      document.getElementById("lumpsumResult").innerHTML = `<p>Error fetching data. Please try again.</p>`;
    });
});

// ====================================
// Goal Based Planner Calculator
// ====================================
function simulateSIPForGoal(navData, startDate, endDate, initialSIP, stepUpPercent) {
  let totalInvested = 0, totalUnits = 0;
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    let currentSip = initialSIP * Math.pow(1 + (stepUpPercent / 100), getAnniversaryCount(startDate, currentDate));
    const dateStr = formatDate(currentDate);
    const navValue = getNAVForDate(navData, dateStr);
    totalUnits += currentSip / navValue;
    totalInvested += currentSip;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  const endNAV = getNAVForDate(navData, formatDate(endDate));
  const finalValue = totalUnits * endNAV;
  return finalValue;
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
  let low = 0, high = target / (years * 12);
  let mid;
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
          resultHTML += `<p>Required Lumpsum Investment: ₹${requiredLumpsum.toFixed(2)}</p>`;
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
          resultHTML += `<p>Required Monthly SIP (with ${stepUp}% step-up): ₹${requiredSIP.toFixed(2)}</p>`;
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
        resultHTML += `<p>Additional required Monthly SIP: ₹${requiredSIP.toFixed(2)}</p>`;
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
        resultHTML += `<p>Additional required Lumpsum Investment: ₹${requiredLumpsum.toFixed(2)}</p>`;
      }
    }
  }
  document.getElementById("goalResult").innerHTML = resultHTML;
});
  
// ====================================
// Dynamic UI for Goal Based Planner
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
// Retirement Planner Calculator
// ====================================
function calculateRetirementCorpus(currentSavings, monthlyContribution, years, stepUp, annualReturn, inflationEnabled, inflationRate) {
  const n = years * 12;
  const r = annualReturn / 100 / 12;
  let corpusFromSavings = currentSavings * Math.pow(1 + r, n);
  let corpusFromContributions = 0;
  for (let m = 0; m < n; m++) {
    let yearsPassed = Math.floor(m / 12);
    let contribution = monthlyContribution * Math.pow(1 + (stepUp / 100), yearsPassed);
    corpusFromContributions += contribution * Math.pow(1 + r, n - m);
  }
  let totalCorpus = corpusFromSavings + corpusFromContributions;
  if (inflationEnabled) {
    const monthlyInflation = inflationRate / 100 / 12;
    totalCorpus = totalCorpus / Math.pow(1 + monthlyInflation, n);
  }
  return totalCorpus;
}
document.getElementById("calcRetirement").addEventListener("click", function() {
  const currentAge = parseFloat(document.getElementById("currentAge").value);
  const retirementAge = parseFloat(document.getElementById("retirementAge").value);
  const currentSavings = parseFloat(document.getElementById("currentSavingsRet").value);
  const monthlyContribution = parseFloat(document.getElementById("monthlyContributionRet").value);
  const stepUp = parseFloat(document.getElementById("retStepUp").value) || 0;
  const annualReturn = parseFloat(document.getElementById("retAnnualReturn").value);
  const years = retirementAge - currentAge;
  const inflationEnabled = document.getElementById("retInflationChk").checked;
  const inflationRate = inflationEnabled ? parseFloat(document.getElementById("retInflationRate").value) || 0 : 0;
  const corpus = calculateRetirementCorpus(currentSavings, monthlyContribution, years, stepUp, annualReturn, inflationEnabled, inflationRate);
  document.getElementById("retirementResult").innerHTML =
    `<h3>Retirement Planner Results:</h3>
     <p>Estimated Corpus at Retirement: ₹${corpus.toFixed(2)}</p>`;
});
document.getElementById("retInflationChk").addEventListener("change", function() {
  document.getElementById("retInflationContainer").style.display = this.checked ? "block" : "none";
});

// ====================================
// Children Education Planner Calculator
// ====================================
function calculateEducationPlanner(childAge, eduAge, currentCost, inflationRate, monthlyContribution, stepUp, annualReturn, currentSavings) {
  const years = eduAge - childAge;
  const futureCost = currentCost * Math.pow(1 + inflationRate / 100, years);
  const n = years * 12;
  const r = annualReturn / 100 / 12;
  let futureSavings = currentSavings * Math.pow(1 + r, n);
  let futureContributions = 0;
  for (let m = 0; m < n; m++) {
    let yearsPassed = Math.floor(m / 12);
    let contribution = monthlyContribution * Math.pow(1 + (stepUp / 100), yearsPassed);
    futureContributions += contribution * Math.pow(1 + r, n - m);
  }
  const totalCorpus = futureSavings + futureContributions;
  return { futureCost, totalCorpus, gap: Math.max(0, futureCost - totalCorpus) };
}
document.getElementById("calcEducation").addEventListener("click", function() {
  const childAge = parseFloat(document.getElementById("childAge").value);
  const eduAge = parseFloat(document.getElementById("eduAge").value);
  const currentCost = parseFloat(document.getElementById("currentCostEdu").value);
  const inflationRate = parseFloat(document.getElementById("eduInflationRate").value) || 0;
  const monthlyContribution = parseFloat(document.getElementById("monthlyContributionEdu").value);
  const stepUp = parseFloat(document.getElementById("eduStepUp").value) || 0;
  const annualReturn = parseFloat(document.getElementById("eduAnnualReturn").value);
  const currentSavings = parseFloat(document.getElementById("currentSavingsEdu").value);
  const { futureCost, totalCorpus, gap } = calculateEducationPlanner(childAge, eduAge, currentCost, inflationRate, monthlyContribution, stepUp, annualReturn, currentSavings);
  document.getElementById("educationResult").innerHTML =
    `<h3>Children Education Planner Results:</h3>
     <p>Estimated Cost at Education Age: ₹${futureCost.toFixed(2)}</p>
     <p>Future Value of Savings & Contributions: ₹${totalCorpus.toFixed(2)}</p>
     <p>Gap (Additional Corpus Needed): ₹${gap.toFixed(2)}</p>`;
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
       <p>Monthly EMI: ₹${result.EMI.toFixed(2)}</p>
       <p>Total Interest Payable: ₹${result.totalInterest.toFixed(2)}</p>
       <p>Total Payment: ₹${result.totalPayment.toFixed(2)}</p>`;
    simulateLoanEMI(loanAmount, loanInterest, loanTenure);
  } else if (loanMode === "tenure") {
    document.getElementById("loanResult").innerHTML = `<h3>Loan Calculator Results (Tenure Mode):</h3><p>Feature under development.</p>`;
  } else if (loanMode === "rate") {
    document.getElementById("loanResult").innerHTML = `<h3>Loan Calculator Results (Rate Mode):</h3><p>Feature under development.</p>`;
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
// Toggle Button Functionality
// ====================================
document.querySelectorAll(".toggle-btn").forEach(btn => {
  btn.addEventListener("click", function() {
    const targetId = this.getAttribute("data-target");
    const content = document.getElementById(targetId);
    if (content.style.display === "none" || content.style.display === "") {
      content.style.display = "block";
    } else {
      content.style.display = "none";
    }
  });
});
